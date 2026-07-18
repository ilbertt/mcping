export const APP_NAME = 'mcping';

export interface McpServer {
  id: string;
  name: string;
  url: string;
  autoConnect: boolean;
  requireApproval: boolean;
  autoSend: boolean;
}

export interface Settings {
  servers: McpServer[];
  launchAtLogin: boolean;
}

// Per-server defaults, reused as the seed for a fresh install and as the
// template when the user adds a server.
// 127.0.0.1 (not localhost) avoids IPv4/IPv6 ambiguity on the default host.
// requireApproval defaults on: a remote server should not silently drive a
// desktop app without the user confirming each action.
export const DEFAULT_SERVER: Omit<McpServer, 'id'> = {
  name: 'My server',
  url: 'http://127.0.0.1:3050/mcp',
  autoConnect: true,
  requireApproval: true,
  autoSend: false,
};

export const DEFAULT_SETTINGS: Settings = {
  servers: [{ id: 'default', ...DEFAULT_SERVER }],
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

export interface AccessibilityStatus {
  trusted: boolean;
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
  mcpTestAction: 'mcp:test-action',
  accessibilityCheck: 'accessibility:check',
  accessibilityOpenSettings: 'accessibility:open-settings',
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
  runTestAction: (serverId: string) => Promise<void>;
  checkAccessibility: () => Promise<AccessibilityStatus>;
  openAccessibilitySettings: () => Promise<void>;
  getLog: () => Promise<LogEntry[]>;
  onLog: (listener: (entry: LogEntry) => void) => () => void;
}
