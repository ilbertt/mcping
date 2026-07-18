export const APP_NAME = 'mcping';

export interface Settings {
  serverUrl: string;
  notificationMethod: string;
  autoSend: boolean;
  claudeAppName: string;
  autoConnect: boolean;
  launchAtLogin: boolean;
}

// 127.0.0.1 (not localhost) avoids IPv4/IPv6 ambiguity on the default host.
export const DEFAULT_SETTINGS: Settings = {
  serverUrl: 'http://127.0.0.1:3050/mcp',
  notificationMethod: 'custom/test',
  autoSend: false,
  claudeAppName: 'Claude',
  autoConnect: true,
  launchAtLogin: false,
};

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionStatus {
  state: ConnectionState;
  detail?: string;
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
  mcpConnect: 'mcp:connect',
  mcpDisconnect: 'mcp:disconnect',
  mcpGetStatus: 'mcp:get-status',
  mcpStatus: 'mcp:status',
  mcpTestAction: 'mcp:test-action',
  accessibilityCheck: 'accessibility:check',
  accessibilityOpenSettings: 'accessibility:open-settings',
  logGet: 'log:get',
  logEntry: 'log:entry',
} as const;

export interface McpingApi {
  getSettings: () => Promise<Settings>;
  setSettings: (patch: Partial<Settings>) => Promise<Settings>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  getStatus: () => Promise<ConnectionStatus>;
  onStatus: (listener: (status: ConnectionStatus) => void) => () => void;
  runTestAction: () => Promise<void>;
  checkAccessibility: () => Promise<AccessibilityStatus>;
  openAccessibilitySettings: () => Promise<void>;
  getLog: () => Promise<LogEntry[]>;
  onLog: (listener: (entry: LogEntry) => void) => () => void;
}
