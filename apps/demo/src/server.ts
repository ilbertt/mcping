import { MCPING_EXTENSION_ID } from '@repo/mcping-protocol';
import { createDemoServer, DEMO_HOST, DEMO_MCP_PATH } from '#create-server.ts';

const PORT = 3050;
const MCP_URL = `http://${DEMO_HOST}:${PORT}${DEMO_MCP_PATH}`;

const server = createDemoServer();

// idleTimeout: 0 disables Bun's 10s socket idle timeout so the long-lived
// subscriptions/listen SSE stream is not closed while it sits idle.
Bun.serve({
  hostname: DEMO_HOST,
  port: PORT,
  idleTimeout: 0,
  fetch: (request) => server.fetch(request),
});

process.stdout.write(
  `mcping demo server — MCP 2026-07-28 (stateless)\n\nURL: ${MCP_URL}\nExtension: ${MCPING_EXTENSION_ID}\n\nSubscribers receive each line you type as a push.\nType the message to send to mcping:\n> `,
);

for await (const line of console) {
  const text = line.trim();
  if (text) {
    const notified = server.push({ title: text, body: 'Sent from demo server' });
    if (notified === 0) {
      process.stdout.write('No mcping client subscribed.\n');
    }
  }
  process.stdout.write('> ');
}
