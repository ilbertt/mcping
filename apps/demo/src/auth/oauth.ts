import type { CustomProviderConfig, OAuthProvider } from 'mcp-use/server';
import { oauthCustomProvider } from 'mcp-use/server';

const CREATED = 201;
const NOT_FOUND = 404;

const METADATA_PATH = '/.well-known/oauth-authorization-server';
const AUTHORIZE_PATH = '/authorize';
const TOKEN_PATH = '/token';
const REGISTER_PATH = '/register';

export interface LocalOAuthServer {
  provider: OAuthProvider;
  issuer: string;
}

// A throwaway OAuth 2.1 authorization server for the demo: it advertises the
// endpoints mcping's client discovers, registers any client, auto-approves every
// authorization request, and issues in-memory bearer tokens. Just enough to
// exercise mcping's OAuth path locally — it checks no PKCE and protects nothing.
export function startLocalOAuthServer(options: { host: string; port: number }): LocalOAuthServer {
  const { host, port } = options;
  const issuer = `http://${host}:${port}`;
  const tokens = new Set<string>();

  const metadata = {
    issuer,
    authorization_endpoint: `${issuer}${AUTHORIZE_PATH}`,
    token_endpoint: `${issuer}${TOKEN_PATH}`,
    registration_endpoint: `${issuer}${REGISTER_PATH}`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  };

  const verifyToken: CustomProviderConfig['verifyToken'] = (token) =>
    tokens.has(token)
      ? Promise.resolve({ payload: { sub: 'mcping-demo-user' } })
      : Promise.reject(new Error('Unknown access token'));

  const provider = oauthCustomProvider({
    issuer,
    authEndpoint: metadata.authorization_endpoint,
    tokenEndpoint: metadata.token_endpoint,
    verifyToken,
  });

  // Dynamic client registration: the MCP client validates that the response
  // echoes redirect_uris, so return them alongside a fresh client id.
  const register = async (request: Request): Promise<Response> => {
    const body = (await request.json().catch(() => ({}))) as { redirect_uris?: string[] };
    return Response.json(
      {
        client_id: crypto.randomUUID(),
        redirect_uris: body.redirect_uris ?? [],
        token_endpoint_auth_method: 'none',
      },
      { status: CREATED },
    );
  };

  Bun.serve({
    hostname: host,
    port,
    fetch: (request) => {
      const url = new URL(request.url);
      switch (`${request.method} ${url.pathname}`) {
        case `GET ${METADATA_PATH}`:
          return Response.json(metadata);
        case `POST ${REGISTER_PATH}`:
          return register(request);
        case `GET ${AUTHORIZE_PATH}`: {
          const redirect = new URL(url.searchParams.get('redirect_uri') ?? issuer);
          redirect.searchParams.set('code', crypto.randomUUID());
          const state = url.searchParams.get('state');
          if (state) {
            redirect.searchParams.set('state', state);
          }
          return Response.redirect(redirect.toString());
        }
        case `POST ${TOKEN_PATH}`: {
          const accessToken = crypto.randomUUID();
          tokens.add(accessToken);
          return Response.json({ access_token: accessToken, token_type: 'Bearer' });
        }
        default:
          return new Response('Not found', { status: NOT_FOUND });
      }
    },
  });

  return { provider, issuer };
}
