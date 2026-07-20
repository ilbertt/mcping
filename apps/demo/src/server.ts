import { buildMcpingNotification, MCPING_METHODS } from '@repo/mcping-protocol';
import { createMCPServer } from 'mcp-use/server';
import { setupAuth } from '#auth/setup.ts';
import { parseCliOptions } from '#cli.ts';

// Production mode skips mcp-use's dev widget toolchain (Vite/React/Tailwind), unused here.
process.env.NODE_ENV ??= 'production';

const PORT = 3050;
// The local OAuth authorization server runs on its own port: its issuer must
// differ from the MCP server's base URL, or mcp-use's metadata proxy loops.
const AUTH_PORT = 3051;
// Not "localhost": mcp-use's default can bind IPv6-only, unreachable from mcping's IPv4 URL.
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const MCP_URL = `${BASE_URL}/mcp`;

// Silence mcp-use's chatter so only the demo's prompt shows: startup banners
// (tag-prefixed) and per-request logs (timestamp-prefixed, ANSI-wrapped).
const FRAMEWORK_LOG =
  /^\s*(\[(CSP|WIDGETS|INSPECTOR|MCP|SERVER|OAuth)\]|widgetsDir|📋|Tools:|Prompts:|Resources:)/u;
const REQUEST_LOG = /\[\d{2}:\d{2}:\d{2}\.\d{3}\]/u;
const realLog = console.log.bind(console);
console.log = (...args: unknown[]) => {
  const first = args[0];
  if (typeof first === 'string' && (FRAMEWORK_LOG.test(first) || REQUEST_LOG.test(first))) {
    return;
  }
  realLog(...args);
};

const { authMode } = parseCliOptions();
const auth = setupAuth({ authMode, host: HOST, oauthPort: AUTH_PORT });

const server = createMCPServer('mcping-demo', {
  version: '0.1.0',
  description: 'Type in the terminal to ping mcping',
  host: HOST,
  baseUrl: BASE_URL,
  ...auth.serverOptions,
});
auth.protect?.(server);

// Serve via Bun.serve rather than server.listen(): under Bun, mcp-use's
// @hono/node-server path drops returned-response bodies (OAuth discovery would
// come back empty). getHandler() runs the same app in fetch mode, which Bun
// serves natively, so metadata and error bodies are delivered intact.
const handler = await server.getHandler();
Bun.serve({ hostname: HOST, port: PORT, fetch: handler });

process.stdout.write(
  `URL: ${MCP_URL}\nAuthentication: ${auth.summary}\n\nType here the message to send to mcping:\n> `,
);

for await (const line of console) {
  const text = line.trim();
  if (text) {
    const clients = server.getActiveSessions().length;
    if (clients === 0) {
      process.stdout.write('No mcping client connected.\n');
    } else {
      const { method, params } = buildMcpingNotification({
        method: MCPING_METHODS.push,
        params: { title: text, body: 'Sent from demo mcp server' },
      });
      await server.sendNotification(method, params);
    }
  }
  process.stdout.write('> ');
}
