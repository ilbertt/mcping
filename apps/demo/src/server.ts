import { createDemoServer, DEMO_HOST, DEMO_MCP_PATH } from '#create-server.ts';
import { MCPING_EXTENSION_ID } from '#extension.ts';

const PORT = 3050;
const MCP_URL = `http://${DEMO_HOST}:${PORT}${DEMO_MCP_PATH}`;

const server = createDemoServer();
const handler = server.getHandler();
// idleTimeout: 0 disables Bun's 10s socket idle timeout so long-lived SSE
// response streams (e.g. a subscriptions/listen stream) are not closed while idle.
Bun.serve({
  hostname: DEMO_HOST,
  port: PORT,
  idleTimeout: 0,
  fetch: (request) => handler(request),
});

process.stdout.write(
  `mcping demo server — MCP 2026-07-28 (stateless)\n\nURL: ${MCP_URL}\nExtension: ${MCPING_EXTENSION_ID}\n\nCall the "run-demo-deploy" tool to emit mcping pushes.\n`,
);
