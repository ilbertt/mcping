import { buildMcpingNotification, MCPING_METHODS } from '@repo/mcping-protocol';
import { createMCPServer } from 'mcp-use/server';

// Production mode skips mcp-use's dev widget toolchain (Vite/React/Tailwind), unused here.
process.env.NODE_ENV ??= 'production';

const PORT = 3050;
// Not "localhost": mcp-use's default can bind IPv6-only, unreachable from mcping's IPv4 URL.
const HOST = '127.0.0.1';

// Silence mcp-use's noisy widget/inspector startup logging.
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
  const { method, params } = buildMcpingNotification({
    method: MCPING_METHODS.push,
    params: { title: text },
  });
  await server.sendNotification(method, params);
  console.log(`→ pinged ${clients} client${clients === 1 ? '' : 's'}: ${text}`);
}
