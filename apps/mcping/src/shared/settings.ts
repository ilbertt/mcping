import type { McpServer } from '#shared/server.ts';

export interface Settings {
  servers: McpServer[];
  launchAtLogin: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  servers: [],
  launchAtLogin: false,
};
