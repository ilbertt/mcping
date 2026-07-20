import type { ServerAuthState } from '#shared/auth.ts';
import type { ServerStatus } from '#shared/connection.ts';
import type { LogEntry } from '#shared/log.ts';
import type { ServerDraft } from '#shared/server.ts';
import type { Settings } from '#shared/settings.ts';

export interface McpingApi {
  getSettings: () => Promise<Settings>;
  setSettings: (patch: Partial<Omit<Settings, 'servers'>>) => Promise<Settings>;
  addServer: (draft: ServerDraft) => Promise<Settings>;
  updateServer: (options: { id: string; patch: Partial<ServerDraft> }) => Promise<Settings>;
  removeServer: (id: string) => Promise<Settings>;
  setServerSecret: (options: { id: string; secret: string }) => Promise<void>;
  getAuthStates: () => Promise<Record<string, ServerAuthState>>;
  signOut: (id: string) => Promise<void>;
  connect: (serverId: string) => Promise<void>;
  disconnect: (serverId: string) => Promise<void>;
  getStatuses: () => Promise<ServerStatus[]>;
  onStatus: (listener: (status: ServerStatus) => void) => () => void;
  getLog: () => Promise<LogEntry[]>;
  onLog: (listener: (entry: LogEntry) => void) => () => void;
}
