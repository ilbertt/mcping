import Store from 'electron-store';
import type { McpServer, ServerDraft, Settings } from '#shared/types.ts';
import { DEFAULT_SETTINGS } from '#shared/types.ts';

let store: Store<Settings> | null = null;

function requireStore(): Store<Settings> {
  if (!store) {
    store = new Store<Settings>({ defaults: DEFAULT_SETTINGS });
  }
  return store;
}

export function getSettings(): Settings {
  return requireStore().store;
}

export function updateSettings(patch: Partial<Omit<Settings, 'servers'>>): Settings {
  const next: Settings = { ...requireStore().store, ...patch };
  requireStore().store = next;
  return next;
}

export function getServer(id: string): McpServer | undefined {
  return requireStore().store.servers.find((server) => server.id === id);
}

export function addServer(draft: ServerDraft): Settings {
  const server: McpServer = { id: crypto.randomUUID(), ...draft };
  const current = requireStore().store;
  const next: Settings = { ...current, servers: [...current.servers, server] };
  requireStore().store = next;
  return next;
}

export function updateServer(options: { id: string; patch: Partial<ServerDraft> }): Settings {
  const current = requireStore().store;
  const next: Settings = {
    ...current,
    servers: current.servers.map((server) =>
      server.id === options.id ? { ...server, ...options.patch } : server,
    ),
  };
  requireStore().store = next;
  return next;
}

export function removeServer(id: string): Settings {
  const current = requireStore().store;
  const next: Settings = {
    ...current,
    servers: current.servers.filter((server) => server.id !== id),
  };
  requireStore().store = next;
  return next;
}
