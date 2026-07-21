import {
  JSONRPC_VERSION,
  ProtocolErrorCode,
  SUBSCRIPTION_ID_META_KEY,
} from '@modelcontextprotocol/server';
import {
  buildMcpingNotification,
  MCPING_EXTENSION_CAPABILITY,
  MCPING_EXTENSION_ID,
  MCPING_METHODS,
  type McpingPushParams,
  McpingSubscriptionFilterSchema,
} from '@repo/mcping-protocol';

export const DEMO_HOST = '127.0.0.1';
export const DEMO_MCP_PATH = '/mcp';
// The SDK's own LATEST_PROTOCOL_VERSION still lags at 2025-11-25, so the target
// revision this hand-wired server serves has to be a local literal.
const PROTOCOL_VERSION = '2026-07-28';

const HTTP_ACCEPTED = 202;
const HTTP_METHOD_NOT_ALLOWED = 405;
const KEEPALIVE_MS = 15_000;

const SSE_HEADERS = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache',
  'x-accel-buffering': 'no',
} as const;

const encoder = new TextEncoder();

type JsonRpcId = string | number;

interface OpenSubscription {
  id: JsonRpcId;
  enqueue: (frame: unknown) => void;
}

function sseFrame(frame: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(frame)}\n\n`);
}

function jsonResult(args: { id: JsonRpcId; result: Record<string, unknown> }): Response {
  return Response.json({ jsonrpc: JSONRPC_VERSION, id: args.id, result: args.result });
}

function jsonRpcError(args: { id: JsonRpcId | null; code: number; message: string }): Response {
  return Response.json({
    jsonrpc: JSONRPC_VERSION,
    id: args.id,
    error: { code: args.code, message: args.message },
  });
}

function discoverResult(): Record<string, unknown> {
  return {
    resultType: 'complete',
    serverInfo: { name: 'mcping-demo', version: '0.1.0' },
    supportedVersions: [PROTOCOL_VERSION],
    // The mcping extension is declared here (spec `ServerCapabilities.extensions`),
    // so it surfaces in `server/discover`.
    capabilities: { tools: {}, extensions: MCPING_EXTENSION_CAPABILITY },
    instructions: `Subscribe via subscriptions/listen with { "push": true } (extension ${MCPING_EXTENSION_ID}) to receive ${MCPING_METHODS.push} notifications.`,
  };
}

/**
 * A minimal, hand-wired stateless MCP server (protocol revision 2026-07-28).
 *
 * It exists because no server library at this beta stage can publish a custom
 * extension notification on a `subscriptions/listen` stream — `createMcpHandler`
 * drives that stream from a closed four-event bus. So the demo drives the listen
 * stream directly: it declares the mcping extension in `server/discover`, and
 * when a client opens `subscriptions/listen` with the mcping opt-in
 * (`{ push: true }`), the server acknowledges it and pushes
 * `notifications/mcping/push` frames on that long-lived stream — the display-only
 * receive path, no tool call involved.
 */
export interface DemoServer {
  fetch: (request: Request) => Promise<Response>;
  /** Push to every open subscription; returns how many were notified. */
  push: (params: McpingPushParams) => number;
}

export function createDemoServer(): DemoServer {
  const subscriptions = new Set<OpenSubscription>();

  function push(params: McpingPushParams): number {
    const built = buildMcpingNotification({ method: MCPING_METHODS.push, params });
    for (const sub of subscriptions) {
      sub.enqueue({
        jsonrpc: JSONRPC_VERSION,
        method: built.method,
        params: { ...built.params, _meta: { [SUBSCRIPTION_ID_META_KEY]: sub.id } },
      });
    }
    return subscriptions.size;
  }

  function openListenStream(args: { id: JsonRpcId; wantsPush: boolean }): Response {
    const { id, wantsPush } = args;
    let sub: OpenSubscription | undefined;
    let keepAlive: ReturnType<typeof setInterval> | undefined;
    const stream = new ReadableStream({
      start(controller) {
        const enqueue = (frame: unknown): void => controller.enqueue(sseFrame(frame));
        // Spec: the acknowledgment MUST be the first message and carries the
        // subscription id (= this request's JSON-RPC id) in `_meta`.
        enqueue({
          jsonrpc: JSONRPC_VERSION,
          method: 'notifications/subscriptions/acknowledged',
          params: {
            _meta: { [SUBSCRIPTION_ID_META_KEY]: id },
            notifications: wantsPush ? { push: true } : {},
          },
        });
        if (wantsPush) {
          sub = { id, enqueue };
          subscriptions.add(sub);
        }
        keepAlive = setInterval(() => controller.enqueue(encoder.encode(':\n\n')), KEEPALIVE_MS);
      },
      cancel() {
        if (keepAlive !== undefined) {
          clearInterval(keepAlive);
        }
        if (sub) {
          subscriptions.delete(sub);
        }
      },
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }

  async function fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: HTTP_METHOD_NOT_ALLOWED });
    }
    const body = (await request.json().catch(() => null)) as {
      id?: JsonRpcId;
      method?: string;
      params?: { notifications?: unknown };
    } | null;
    if (!body || typeof body.method !== 'string') {
      return jsonRpcError({
        id: null,
        code: ProtocolErrorCode.InvalidRequest,
        message: 'Invalid Request',
      });
    }
    if (body.id === undefined) {
      return new Response(null, { status: HTTP_ACCEPTED });
    }
    const { id, method } = body;
    switch (method) {
      case 'server/discover':
        return jsonResult({ id, result: discoverResult() });
      case 'tools/list':
        return jsonResult({ id, result: { resultType: 'complete', tools: [] } });
      case 'ping':
        return jsonResult({ id, result: {} });
      case 'subscriptions/listen': {
        const parsed = McpingSubscriptionFilterSchema.safeParse(body.params?.notifications ?? {});
        return openListenStream({ id, wantsPush: parsed.success && parsed.data.push === true });
      }
      default:
        return jsonRpcError({
          id,
          code: ProtocolErrorCode.MethodNotFound,
          message: `Method not found: ${method}`,
        });
    }
  }

  return { fetch, push };
}
