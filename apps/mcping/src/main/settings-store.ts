import Store from 'electron-store';
import type { McpServer, ServerDraft, Settings } from '#shared/types.ts';
import { DEFAULT_SERVER, DEFAULT_SETTINGS } from '#shared/types.ts';

// Store defaults only backfill absent top-level keys, so servers persisted before
// `auth` existed keep coming back without it. Fill it in on load.
function normalizeServers(target: Store<Settings>): void {
  const servers = target.store.servers;
  if (servers.every((server) => server.auth !== undefined)) {
    return;
  }
  target.set(
    'servers',
    servers.map((server) => (server.auth ? server : { ...server, auth: DEFAULT_SERVER.auth })),
  );
}

let store: Store<Settings> | null = null;

// Fields from the pre-multi-server flat settings shape. Kept only to migrate an
// existing single-server config into the `servers` list on first launch.
interface LegacySettings {
  serverUrl?: string;
  notificationMethod?: string;
  autoConnect?: boolean;
}

const LEGACY_KEYS: (keyof LegacySettings)[] = ['serverUrl', 'notificationMethod', 'autoConnect'];

function migrateLegacy(target: Store<Settings>): void {
  const legacy = target.store as unknown as LegacySettings;
  // Guard on `serverUrl` rather than `servers`: defaults always backfill
  // `servers`, so its presence can't distinguish a legacy store.
  if (legacy.serverUrl === undefined) {
    return;
  }
  const migrated: McpServer = {
    id: 'default',
    name: DEFAULT_SERVER.name,
    url: legacy.serverUrl,
    autoConnect: legacy.autoConnect ?? DEFAULT_SERVER.autoConnect,
    auth: DEFAULT_SERVER.auth,
  };
  target.set('servers', [migrated]);
  for (const key of LEGACY_KEYS) {
    target.delete(key as keyof Settings);
  }
}

function requireStore(): Store<Settings> {
  if (!store) {
    store = new Store<Settings>({ defaults: DEFAULT_SETTINGS });
    migrateLegacy(store);
    normalizeServers(store);
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
