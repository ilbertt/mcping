import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import { getLog } from '#main/logger.ts';
import { syncLoginItem } from '#main/login-item.ts';
import { connectServer, disconnectServer, getStatuses, syncServers } from '#main/mcp-listener.ts';
import {
  addServer,
  getSettings,
  removeServer,
  updateServer,
  updateSettings,
} from '#main/settings-store.ts';
import { refreshTray } from '#main/tray.ts';
import type { ServerDraft, Settings } from '#shared/types.ts';
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
    handler: (options) => applyServerChange(updateServer(options)),
  });
  handle<string, Settings>({
    channel: IPC.serversRemove,
    handler: (id) => applyServerChange(removeServer(id)),
  });
  handle<string, void>({ channel: IPC.mcpConnect, handler: (id) => connectServer(id) });
  handle<string, void>({ channel: IPC.mcpDisconnect, handler: (id) => disconnectServer(id) });
  handle({ channel: IPC.mcpGetStatuses, handler: () => getStatuses() });
  handle({ channel: IPC.logGet, handler: () => getLog() });
}
