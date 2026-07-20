import type { createMCPServer } from 'mcp-use/server';

type McpServer = ReturnType<typeof createMCPServer>;

export const API_KEY_HEADER = 'X-API-Key';

const BEARER_PREFIX = 'Bearer ';
const UNAUTHORIZED = 401;
const GUARDED_PATHS = ['/mcp', '/mcp/*'];

// Accept the key as a bearer token or the X-API-Key header (either mcping auth type).
function extractApiKey(headers: {
  authorization: string | undefined;
  apiKeyHeader: string | undefined;
}): string | undefined {
  const { authorization, apiKeyHeader } = headers;
  if (authorization?.startsWith(BEARER_PREFIX)) {
    return authorization.slice(BEARER_PREFIX.length);
  }
  return apiKeyHeader;
}

export function protectWithApiKey(options: { server: McpServer; apiKey: string }): void {
  const { server, apiKey } = options;
  for (const path of GUARDED_PATHS) {
    // biome-ignore lint/complexity/useMaxParams: Hono middleware signature is (context, next).
    server.app.use(path, async (c, next) => {
      const provided = extractApiKey({
        authorization: c.req.header('Authorization'),
        apiKeyHeader: c.req.header(API_KEY_HEADER),
      });
      if (provided !== apiKey) {
        return c.json({ error: 'Missing or invalid API key' }, UNAUTHORIZED);
      }
      await next();
    });
  }
}
