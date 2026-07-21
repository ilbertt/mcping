import { buildMcpingNotification, MCPING_METHODS } from '@repo/mcping-protocol';
import { MCPServer } from 'mcp-use';
import { z } from 'zod';
import { MCPING_EXTENSION_ID } from '#extension.ts';

// Not "localhost": mcping addresses the server by its IPv4 URL, and a default
// bind can resolve IPv6-only, leaving it unreachable.
export const DEMO_HOST = '127.0.0.1';
export const DEMO_MCP_PATH = '/mcp';
export const DEMO_DEPLOY_TOOL = 'run-demo-deploy';

// A deploy reaches two milestones; each is reported as request-scoped progress.
const DEPLOY_STEP_STARTED = 1;
const DEPLOY_STEP_FINISHED = 2;
const DEPLOY_TOTAL_STEPS = 2;

const runDemoDeployInput = z.object({
  service: z.string().min(1).default('demo-service').describe('Name of the service being deployed'),
});

/**
 * The stateless (2026-07-28) demo MCP server, configured with the
 * `run-demo-deploy` tool. Split from the entrypoint so tests can drive
 * `getHandler()` without binding a socket.
 */
export function createDemoServer(): MCPServer {
  const server = new MCPServer({
    name: 'mcping-demo',
    version: '0.1.0',
    description:
      'Stateless MCP server (2026-07-28) that emits mcping pushes from a demo deploy tool',
    instructions: `Call the \`${DEMO_DEPLOY_TOOL}\` tool to run a simulated deployment. It reports request-scoped progress and returns the mcping "${MCPING_METHODS.push}" notifications it produced (extension ${MCPING_EXTENSION_ID}).`,
    host: DEMO_HOST,
    basePath: DEMO_MCP_PATH,
    // Drop mcp-use's per-request log lines and banners so the demo output stays clean.
    logging: { enabled: false },
  });

  server.tool(
    {
      name: DEMO_DEPLOY_TOOL,
      description: 'Run a simulated deployment that emits an mcping "started" and "finished" push.',
      inputSchema: runDemoDeployInput,
      // The spec's home for the extension association is the server's `extensions`
      // capability (server/discover). mcp-use@beta exposes no passthrough for that
      // map (see the demo README, "Design notes"), so we surface the association
      // here in the tool descriptor's vendor-namespaced `_meta` — itself spec-legitimate.
      _meta: { [MCPING_EXTENSION_ID]: { notification: MCPING_METHODS.push } },
    },
    // biome-ignore lint/complexity/useMaxParams: mcp-use tool callbacks are (params, context).
    async ({ service }, ctx) => {
      // The push wire frame (`notifications/mcping/push`) cannot be emitted through
      // mcp-use@beta (no generic notification API — see the demo README). We deliver
      // the two milestones over the one request-scoped channel mcp-use does expose,
      // `reportProgress` (the spec-sanctioned inline path), and return the fully
      // built pushes so a client validates them with `parseMcpingNotification`.
      const started = buildMcpingNotification({
        method: MCPING_METHODS.push,
        params: { title: `Deploying ${service}…`, body: 'Deployment started', priority: 'normal' },
      });
      await ctx.reportProgress(DEPLOY_STEP_STARTED, DEPLOY_TOTAL_STEPS, started.params.title);

      const finished = buildMcpingNotification({
        method: MCPING_METHODS.push,
        params: { title: `Deployed ${service}`, body: 'Deployment finished', priority: 'normal' },
      });
      await ctx.reportProgress(DEPLOY_STEP_FINISHED, DEPLOY_TOTAL_STEPS, finished.params.title);

      const pushes = [started, finished];
      return {
        content: [
          { type: 'text', text: `Emitted ${pushes.length} mcping pushes for "${service}".` },
        ],
        structuredContent: { service, pushes },
      };
    },
  );

  return server;
}
