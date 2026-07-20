import type { createMCPServer, OAuthProvider } from 'mcp-use/server';
import { API_KEY_HEADER, protectWithApiKey } from '#auth/api-key.ts';
import { startLocalOAuthServer } from '#auth/oauth.ts';
import { AuthMode } from '#cli.ts';

type McpServer = ReturnType<typeof createMCPServer>;

// mcp-use configures OAuth natively via createMCPServer; API-key auth has no
// config option, so it is applied to the built server through `protect`.
export interface AuthSetup {
  serverOptions: { oauth?: OAuthProvider };
  protect?: (server: McpServer) => void;
  summary: string;
}

export function setupAuth(options: {
  authMode: AuthMode | undefined;
  host: string;
  oauthPort: number;
}): AuthSetup {
  const { authMode, host, oauthPort } = options;
  switch (authMode) {
    case AuthMode.OAuth: {
      const oauth = startLocalOAuthServer({ host, port: oauthPort });
      return { serverOptions: { oauth: oauth.provider }, summary: 'OAuth' };
    }
    case AuthMode.ApiKey: {
      const apiKey = crypto.randomUUID();
      return {
        serverOptions: {},
        protect: (server) => protectWithApiKey({ server, apiKey }),
        summary: `API key\n  Bearer token or ${API_KEY_HEADER} header: ${apiKey}`,
      };
    }
    default:
      return { serverOptions: {}, summary: 'None' };
  }
}
