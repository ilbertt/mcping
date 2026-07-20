import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import { clearOauth, hasOauthTokens } from '#main/auth/oauth.ts';
import { clearSecret, hasSecret, setSecret } from '#main/auth/secret-store.ts';
import { getLog } from '#main/logger.ts';
import { syncLoginItem } from '#main/login-item.ts';
import {
  connectServer,
  disconnectServer,
  getStatuses,
  reconnectIfActive,
  syncServers,
} from '#main/mcp-listener.ts';
import {
  addServer,
  getServer,
  getSettings,
  removeServer,
  updateServer,
  updateSettings,
} from '#main/settings-store.ts';
import { refreshTray } from '#main/tray.ts';
import type { ServerAuth, ServerAuthState, ServerDraft, Settings } from '#shared/types.ts';
import { IPC } from '#shared/types.ts';

function handle<Req, Res>(options: {
  channel: string;
  handler: (payload: Req) => Res | Promise<Res>;
}): void {
  ipcMain.handle(options.channel, (...args: [IpcMainInvokeEvent, Req]) => options.handler(args[1]));
}

// After the server list changes: reconcile live connections and rebuild the tray
// so both track the new configuration.
function applyServerChange(next: Settings): Settings {
  syncServers();
  refreshTray();
  return next;
}

// A server's auth mode changed: drop the credential the old mode owned so a
// stale token can't linger or leak into a different mode.
function clearStaleAuth(options: { id: string; previous: ServerAuth; next: ServerAuth }): void {
  if (options.previous.type === options.next.type) {
    return;
  }
  if (options.previous.type === 'bearer' || options.previous.type === 'header') {
    clearSecret(options.id);
  }
  if (options.previous.type === 'oauth') {
    clearOauth(options.id);
  }
}

function authStates(): Record<string, ServerAuthState> {
  const states: Record<string, ServerAuthState> = {};
  for (const server of getSettings().servers) {
    states[server.id] = {
      secretSet: hasSecret(server.id),
      oauthAuthorized: hasOauthTokens(server.id),
    };
  }
  return states;
}

export function registerIpc(): void {
  handle({ channel: IPC.settingsGet, handler: () => getSettings() });
  handle<Partial<Omit<Settings, 'servers'>>, Settings>({
    channel: IPC.settingsSet,
    handler: (patch) => {
      const next = updateSettings(patch);
      syncLoginItem(next);
      return next;
    },
  });
  handle<ServerDraft, Settings>({
    channel: IPC.serversAdd,
    handler: (draft) => applyServerChange(addServer(draft)),
  });
  handle<{ id: string; patch: Partial<ServerDraft> }, Settings>({
    channel: IPC.serversUpdate,
    handler: (options) => {
      const previous = getServer(options.id);
      const next = updateServer(options);
      const updated = next.servers.find((server) => server.id === options.id);
      if (previous && updated) {
        clearStaleAuth({ id: options.id, previous: previous.auth, next: updated.auth });
      }
      return applyServerChange(next);
    },
  });
  handle<string, Settings>({
    channel: IPC.serversRemove,
    handler: (id) => {
      clearSecret(id);
      clearOauth(id);
      return applyServerChange(removeServer(id));
    },
  });
  handle<{ id: string; secret: string }, void>({
    channel: IPC.serverSecretSet,
    handler: (options) => {
      setSecret(options);
      reconnectIfActive(options.id);
    },
  });
  handle({ channel: IPC.authGetStates, handler: () => authStates() });
  handle<string, void>({
    channel: IPC.authSignOut,
    handler: async (id) => {
      await disconnectServer(id);
      clearOauth(id);
    },
  });
  handle<string, void>({ channel: IPC.mcpConnect, handler: (id) => connectServer(id) });
  handle<string, void>({ channel: IPC.mcpDisconnect, handler: (id) => disconnectServer(id) });
  handle({ channel: IPC.mcpGetStatuses, handler: () => getStatuses() });
  handle({ channel: IPC.logGet, handler: () => getLog() });
}
