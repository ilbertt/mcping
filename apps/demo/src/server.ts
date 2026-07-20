import { buildMcpingNotification, MCPING_METHODS } from '@repo/mcping-protocol';
import { createMCPServer } from 'mcp-use/server';
import { API_KEY_HEADER, protectWithApiKey } from '#auth/api-key.ts';
import { startLocalOAuthServer } from '#auth/oauth.ts';
import { AuthMode, parseCliOptions } from '#cli.ts';

// Production mode skips mcp-use's dev widget toolchain (Vite/React/Tailwind), unused here.
process.env.NODE_ENV ??= 'production';

const PORT = 3050;
// The local OAuth authorization server runs on its own port: its issuer must
// differ from the MCP server's base URL, or mcp-use's metadata proxy loops.
const AUTH_PORT = 3051;
// Not "localhost": mcp-use's default can bind IPv6-only, unreachable from mcping's IPv4 URL.
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;

const { authMode } = parseCliOptions();

// Silence mcp-use's noisy widget/inspector/oauth startup logging.
const FRAMEWORK_LOG =
  /^\s*(\[(CSP|WIDGETS|INSPECTOR|MCP|SERVER|OAuth)\]|widgetsDir|📋|Tools:|Prompts:|Resources:)/u;
const realLog = console.log.bind(console);
console.log = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && FRAMEWORK_LOG.test(args[0])) {
    return;
  }
  realLog(...args);
};

const localOAuth =
  authMode === AuthMode.OAuth ? startLocalOAuthServer({ host: HOST, port: AUTH_PORT }) : null;

const server = createMCPServer('mcping-demo', {
  version: '0.1.0',
  description: 'Type in the terminal to ping mcping',
  host: HOST,
  baseUrl: BASE_URL,
  ...(localOAuth ? { oauth: localOAuth.provider } : {}),
});

const apiKey = authMode === AuthMode.ApiKey ? crypto.randomUUID() : null;
if (apiKey) {
  protectWithApiKey({ server, apiKey });
}

// Serve via Bun.serve rather than server.listen(): under Bun, mcp-use's
// @hono/node-server path drops returned-response bodies (OAuth discovery would
// come back empty). getHandler() runs the same app in fetch mode, which Bun
// serves natively, so metadata and error bodies are delivered intact.
const handler = await server.getHandler();
Bun.serve({ hostname: HOST, port: PORT, fetch: handler });

function authNote(): string[] {
  if (apiKey) {
    return [
      '',
      'Auth: API key required. In mcping, set the server auth to Bearer token',
      `or "${API_KEY_HEADER}" header and paste this key:`,
      '',
      `  ${apiKey}`,
    ];
  }
  if (localOAuth) {
    return [
      '',
      `Auth: OAuth enabled (local authorization server at ${localOAuth.issuer}).`,
      'In mcping, set the server auth to OAuth and click Connect. Your browser',
      'will open briefly to complete authorization.',
    ];
  }
  return [];
}

console.log(
  [
    '',
    `mcping demo server listening on http://${HOST}:${PORT}/mcp`,
    ...authNote(),
    '',
    'Open mcping and make sure this server is connected, then type a message',
    'below and press Enter to ping yourself. Ctrl+C to quit.',
    '',
  ].join('\n'),
);

for await (const line of console) {
  const text = line.trim();
  if (!text) {
    continue;
  }
  const clients = server.getActiveSessions().length;
  if (clients === 0) {
    console.log('No mcping client connected yet — is the app running with its server enabled?');
    continue;
  }
  const { method, params } = buildMcpingNotification({
    method: MCPING_METHODS.push,
    params: { title: text, body: 'Sent from demo mcp server' },
  });
  await server.sendNotification(method, params);
  console.log(`→ pinged ${clients} client${clients === 1 ? '' : 's'}: ${text}`);
}
