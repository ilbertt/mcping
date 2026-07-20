export const APP_NAME = 'mcping';

export interface McpServer {
  id: string;
  name: string;
  url: string;
  autoConnect: boolean;
}

export interface Settings {
  servers: McpServer[];
  launchAtLogin: boolean;
}

// Per-server defaults: the template when the user adds a server, and the seed
// that debug builds preload (the local demo server) so development needs no
// manual setup. A released install starts with no servers — see settings-store.
// 127.0.0.1 (not localhost) avoids IPv4/IPv6 ambiguity on the default host.
export const DEFAULT_SERVER: Omit<McpServer, 'id'> = {
  name: 'My server',
  url: 'http://127.0.0.1:3050/mcp',
  autoConnect: true,
};

export const DEFAULT_SETTINGS: Settings = {
  servers: [],
  launchAtLogin: false,
};

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionStatus {
  state: ConnectionState;
  detail?: string;
}

export interface ServerStatus {
  serverId: string;
  status: ConnectionStatus;
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  time: string;
  level: LogLevel;
  message: string;
}

export const IPC = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  serversAdd: 'servers:add',
  serversUpdate: 'servers:update',
  serversRemove: 'servers:remove',
  mcpConnect: 'mcp:connect',
  mcpDisconnect: 'mcp:disconnect',
  mcpGetStatuses: 'mcp:get-statuses',
  mcpStatus: 'mcp:status',
  logGet: 'log:get',
  logEntry: 'log:entry',
} as const;

export type ServerDraft = Omit<McpServer, 'id'>;

export interface McpingApi {
  getSettings: () => Promise<Settings>;
  setSettings: (patch: Partial<Omit<Settings, 'servers'>>) => Promise<Settings>;
  addServer: (draft: ServerDraft) => Promise<Settings>;
  updateServer: (options: { id: string; patch: Partial<ServerDraft> }) => Promise<Settings>;
  removeServer: (id: string) => Promise<Settings>;
  connect: (serverId: string) => Promise<void>;
  disconnect: (serverId: string) => Promise<void>;
  getStatuses: () => Promise<ServerStatus[]>;
  onStatus: (listener: (status: ServerStatus) => void) => () => void;
  getLog: () => Promise<LogEntry[]>;
  onLog: (listener: (entry: LogEntry) => void) => () => void;
}
