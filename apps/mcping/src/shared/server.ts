import type { ServerAuth } from '#shared/auth.ts';

export interface McpServer {
  id: string;
  name: string;
  url: string;
  autoConnect: boolean;
  auth: ServerAuth;
}

// The demo server that debug builds preload so development needs no manual setup.
// A released install starts with no servers, and the "Add server" form starts
// empty (placeholders only) — see settings-store and the renderer server card.
// 127.0.0.1 (not localhost) avoids IPv4/IPv6 ambiguity on the default host.
export const DEMO_SERVER: Omit<McpServer, 'id'> = {
  name: 'My server',
  url: 'http://127.0.0.1:3050/mcp',
  autoConnect: true,
  auth: { type: 'none' },
};

export type ServerDraft = Omit<McpServer, 'id'>;
