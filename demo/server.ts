import { buildPushNotification } from '@repo/mcping-protocol';
import { createMCPServer } from 'mcp-use/server';

// mcp-use's server toolchain is built for its full app scaffold (widgets +
// inspector). This is a notification-only server, so we run it in "production"
// mode: that skips the dev widget toolchain that listen() otherwise requires
// (Vite/React/Tailwind) — nothing here is actually built or minified. Read by
// listen() at runtime, so setting it here (before listen) is enough.
process.env.NODE_ENV ??= 'production';

// mcping connects here out of the box: DEFAULT_SERVER.url in apps/mcping is
// http://127.0.0.1:3050/mcp, and mcp-use mounts the MCP endpoint at /mcp.
const PORT = 3050;

// Bind to 127.0.0.1 (not mcp-use's "localhost" default, which can resolve to
// IPv6 ::1 only) so mcping's IPv4 URL reaches us.
const HOST = '127.0.0.1';

// listen() prints a wall of widget/inspector startup probing — including
// harmless "file not found" traces — that don't apply to this server. Drop
// those framework lines so the demo output stays readable; our own logs (which
// don't carry these prefixes) pass through untouched.
const FRAMEWORK_LOG =
  /^\s*(\[(CSP|WIDGETS|INSPECTOR|MCP|SERVER)\]|widgetsDir|📋|Tools:|Prompts:|Resources:)/u;
const realLog = console.log.bind(console);
console.log = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && FRAMEWORK_LOG.test(args[0])) {
    return;
  }
  realLog(...args);
};

const server = createMCPServer('mcping-demo', {
  version: '0.1.0',
  description: 'Type in the terminal to ping mcping',
  host: HOST,
});

await server.listen(PORT);

console.log(
  [
    '',
    `mcping demo server listening on http://${HOST}:${PORT}/mcp`,
    'Open mcping and make sure its default server is connected, then type a',
    'message below and press Enter to ping yourself. Ctrl+C to quit.',
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
  // Build a push notification against the shared contract (@repo/mcping-protocol),
  // the same schema mcping parses on the other end. Here the whole line is the
  // title; `body`, `subtitle`, `priority`, and `silent` are also available.
  const { method, params } = buildPushNotification({ title: text });
  await server.sendNotification(method, params);
  console.log(`→ pinged ${clients} client${clients === 1 ? '' : 's'}: ${text}`);
}
