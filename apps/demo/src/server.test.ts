import { describe, expect, test } from 'bun:test';
import { MCPING_METHODS, parseMcpingNotification } from '@repo/mcping-protocol';
import type { FrameworkHandler } from 'mcp-use';
import { createDemoServer, DEMO_DEPLOY_TOOL, DEMO_HOST, DEMO_MCP_PATH } from '#create-server.ts';
import { isValidThirdPartyExtensionId, MCPING_EXTENSION_ID } from '#extension.ts';

const PROTOCOL_VERSION = '2026-07-28';
const MCP_ENDPOINT = `http://${DEMO_HOST}${DEMO_MCP_PATH}`;
const EXPECTED_PUSH_COUNT = 2;

function requestEnvelope(): Record<string, unknown> {
  return {
    'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
    'io.modelcontextprotocol/clientInfo': { name: 'demo-test', version: '0.0.0' },
    'io.modelcontextprotocol/clientCapabilities': {},
  };
}

async function callRpc<T>(args: {
  handler: FrameworkHandler;
  id: string;
  method: string;
  params?: Record<string, unknown>;
  mcpName?: string;
}): Promise<T> {
  const { handler, id, method, params = {}, mcpName } = args;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': PROTOCOL_VERSION,
    'Mcp-Method': method,
  };
  if (mcpName !== undefined) {
    headers['Mcp-Name'] = mcpName;
  }
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id,
    method,
    params: { ...params, _meta: requestEnvelope() },
  });
  const response = await handler(new Request(MCP_ENDPOINT, { method: 'POST', headers, body }));
  return (await response.json()) as T;
}

describe('demo server on mcp-use@beta (2026-07-28)', () => {
  test('server/discover advertises the 2026-07-28 protocol', async () => {
    const handler = createDemoServer().getHandler();
    const discover = await callRpc<{ result: { supportedVersions: string[] } }>({
      handler,
      id: 'discover',
      method: 'server/discover',
    });
    expect(discover.result.supportedVersions).toContain(PROTOCOL_VERSION);
  });

  test('mcping extension id is a valid, non-reserved third-party identifier', () => {
    expect(isValidThirdPartyExtensionId(MCPING_EXTENSION_ID)).toBe(true);
    // Reserved: second label is `modelcontextprotocol` / `mcp`.
    expect(isValidThirdPartyExtensionId('io.modelcontextprotocol/tasks')).toBe(false);
    expect(isValidThirdPartyExtensionId('dev.mcp/thing')).toBe(false);
    // NOT reserved: second label is `example`.
    expect(isValidThirdPartyExtensionId('com.example.mcp/thing')).toBe(true);
  });

  test('the deploy tool carries the extension association in its _meta', async () => {
    const handler = createDemoServer().getHandler();
    const list = await callRpc<{
      result: { tools: Array<{ name: string; _meta?: Record<string, unknown> }> };
    }>({ handler, id: 'list', method: 'tools/list' });
    const tool = list.result.tools.find((entry) => entry.name === DEMO_DEPLOY_TOOL);
    expect(tool?._meta?.[MCPING_EXTENSION_ID]).toBeDefined();
  });

  test('KNOWN GAP: mcp-use@beta cannot advertise the extension in server/discover', async () => {
    // Tripwire for the gap documented in the demo README: mcp-use@beta hardcodes
    // server capabilities and exposes no passthrough for the `extensions` map, so
    // `io.github.ilbertt/mcping` cannot appear here. If a future mcp-use version
    // fixes this, update the wiring.
    const handler = createDemoServer().getHandler();
    const discover = await callRpc<{ result: { capabilities: { extensions?: unknown } } }>({
      handler,
      id: 'discover',
      method: 'server/discover',
    });
    expect(discover.result.capabilities.extensions).toBeUndefined();
  });

  test('run-demo-deploy returns mcping pushes a client can parse', async () => {
    const handler = createDemoServer().getHandler();
    const call = await callRpc<{ result: { structuredContent: { pushes: unknown[] } } }>({
      handler,
      id: 'call',
      method: 'tools/call',
      params: { name: DEMO_DEPLOY_TOOL, arguments: { service: 'api' } },
      mcpName: DEMO_DEPLOY_TOOL,
    });
    const { pushes } = call.result.structuredContent;
    expect(pushes).toHaveLength(EXPECTED_PUSH_COUNT);
    for (const push of pushes) {
      const parsed = parseMcpingNotification(push);
      expect(parsed).not.toBeNull();
      expect(parsed?.method).toBe(MCPING_METHODS.push);
    }
    expect(parseMcpingNotification(pushes[0])?.params.title).toContain('api');
  });
});
