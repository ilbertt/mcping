import type { ServerAuth } from '#shared/auth.ts';

export interface McpServer {
  id: string;
  name: string;
  url: string;
  autoConnect: boolean;
  auth: ServerAuth;
}

// Per-server defaults: the template when the user adds a server, and the seed
// that debug builds preload (the local demo server) so development needs no
// manual setup. A released install starts with no servers — see settings-store.
// 127.0.0.1 (not localhost) avoids IPv4/IPv6 ambiguity on the default host.
export const DEFAULT_SERVER: Omit<McpServer, 'id'> = {
  name: 'My server',
  url: 'http://127.0.0.1:3050/mcp',
  autoConnect: true,
  auth: { type: 'none' },
};

export type ServerDraft = Omit<McpServer, 'id'>;
