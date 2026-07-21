import { describe, expect, test } from 'bun:test';
import {
  MCPING_EXTENSION_ID,
  MCPING_METHODS,
  MCPING_SUBSCRIPTION_FILTER,
  parseMcpingNotification,
} from '@repo/mcping-protocol';
import { createDemoServer, DEMO_HOST, DEMO_MCP_PATH } from '#create-server.ts';

const PROTOCOL_VERSION = '2026-07-28';
const MCP_ENDPOINT = `http://${DEMO_HOST}${DEMO_MCP_PATH}`;
const SUBSCRIPTION_ID_KEY = 'io.modelcontextprotocol/subscriptionId';

function rpcRequest(args: {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}): Request {
  return new Request(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': PROTOCOL_VERSION,
      'mcp-method': args.method,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: args.id,
      method: args.method,
      params: {
        ...args.params,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
          'io.modelcontextprotocol/clientInfo': { name: 'demo-test', version: '0.0.0' },
          'io.modelcontextprotocol/clientCapabilities': {
            extensions: { [MCPING_EXTENSION_ID]: {} },
          },
        },
      },
    }),
  });
}

type ByteReader = { read: () => Promise<{ done: boolean; value?: Uint8Array }> };

/** Read SSE `data:` blocks, yielding each parsed JSON-RPC frame (comments skipped). */
async function readSseFrame(reader: ByteReader): Promise<unknown> {
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const separator = buffer.indexOf('\n\n');
    if (separator !== -1) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim())
        .join('');
      if (data.length > 0) {
        return JSON.parse(data);
      }
      continue;
    }
    const { value, done } = await reader.read();
    if (done) {
      throw new Error('stream ended before a data frame');
    }
    if (value) {
      buffer += decoder.decode(value, { stream: true });
    }
  }
}

describe('demo server on the raw 2026-07-28 server SDK', () => {
  test('server/discover advertises 2026-07-28 and the mcping extension', async () => {
    const server = createDemoServer();
    const response = await server.fetch(rpcRequest({ id: 'd', method: 'server/discover' }));
    const body = (await response.json()) as {
      result: {
        supportedVersions: string[];
        capabilities: { extensions?: Record<string, unknown> };
      };
    };
    expect(body.result.supportedVersions).toContain(PROTOCOL_VERSION);
    expect(body.result.capabilities.extensions?.[MCPING_EXTENSION_ID]).toBeDefined();
  });

  test('a client subscribes via subscriptions/listen and receives a parsed push', async () => {
    const server = createDemoServer();
    const response = await server.fetch(
      rpcRequest({
        id: 'sub-1',
        method: 'subscriptions/listen',
        params: { notifications: MCPING_SUBSCRIPTION_FILTER },
      }),
    );
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('no SSE body');
    }

    const ack = (await readSseFrame(reader)) as { method: string; params: Record<string, unknown> };
    expect(ack.method).toBe('notifications/subscriptions/acknowledged');
    expect((ack.params._meta as Record<string, unknown>)[SUBSCRIPTION_ID_KEY]).toBe('sub-1');

    const notified = server.push({ title: 'Deploy finished', body: 'prod #4821' });
    expect(notified).toBe(1);

    const frame = await readSseFrame(reader);
    const parsed = parseMcpingNotification(frame);
    expect(parsed).not.toBeNull();
    expect(parsed?.method).toBe(MCPING_METHODS.push);
    expect(parsed?.params.title).toBe('Deploy finished');
    expect(
      (frame as { params: { _meta: Record<string, unknown> } }).params._meta[SUBSCRIPTION_ID_KEY],
    ).toBe('sub-1');

    await reader.cancel();
  });

  test('a listen without the mcping opt-in receives no pushes', async () => {
    const server = createDemoServer();
    const response = await server.fetch(
      rpcRequest({ id: 'sub-2', method: 'subscriptions/listen', params: { notifications: {} } }),
    );
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('no SSE body');
    }
    await readSseFrame(reader); // acknowledgment
    expect(server.subscriberCount()).toBe(0);
    expect(server.push({ title: 'ignored' })).toBe(0);
    await reader.cancel();
  });
});
