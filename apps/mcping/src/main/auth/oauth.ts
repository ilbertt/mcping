import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import type {
  OAuthClientMetadata,
  OAuthClientProvider,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from '@modelcontextprotocol/client';
import { app } from 'electron';
import { secretCipher } from '#main/auth/secret-cipher.ts';

const OAUTH_DIR = 'oauth';
const CLIENT_NAME = 'mcping';
const CLIENT_URI = 'https://github.com/ilbertt/mcping';
const CALLBACK_PATH = '/oauth/callback';
const FILE_MODE = 0o600;
const DIR_MODE = 0o700;
const STORE_SUFFIX = '.bin';
const CLIENT_INFO_KEY = 'client_information';
const TOKENS_KEY = 'tokens';
const CODE_VERIFIER_KEY = 'code_verifier';
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const CALLBACK_PAGE =
  '<!doctype html><title>mcping</title>Authorization complete — you can close this window.';

function serverDir(serverId: string): string {
  return join(app.getPath('userData'), OAUTH_DIR, serverId);
}

function encodeKey(key: string): string {
  return Buffer.from(key).toString('base64url');
}

function decodeKey(name: string): string {
  return Buffer.from(name, 'base64url').toString('utf8');
}

// Keychain-encrypted, file-backed store for the OAuth session the SDK owns
// (client registration, PKCE verifier, tokens). One directory per server so
// removing a server is a clean `rm -rf`, and every value on disk is ciphertext.
class EncryptedKvStore {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  private fileFor(key: string): string {
    return join(this.dir, `${encodeKey(key)}${STORE_SUFFIX}`);
  }

  get(key: string): string | null {
    const file = this.fileFor(key);
    if (!existsSync(file)) {
      return null;
    }
    try {
      return secretCipher.decrypt(readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  }

  // biome-ignore lint/complexity/useMaxParams: internal key/value store setter.
  set(key: string, value: string): void {
    mkdirSync(this.dir, { recursive: true, mode: DIR_MODE });
    const file = this.fileFor(key);
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, secretCipher.encrypt(value), { mode: FILE_MODE });
    renameSync(tmp, file);
  }

  keys(): string[] {
    if (!existsSync(this.dir)) {
      return [];
    }
    return readdirSync(this.dir)
      .filter((name) => name.endsWith(STORE_SUFFIX))
      .map((name) => decodeKey(name.slice(0, -STORE_SUFFIX.length)));
  }
}

/**
 * The interactive OAuth client provider the v2 SDK's transport drives
 * (`authProvider`). We implement storage against the keychain-encrypted
 * {@link EncryptedKvStore} and run a loopback HTTP server to capture the
 * authorization-code redirect; the SDK's `auth()` / `transport.finishAuth()`
 * own discovery, dynamic registration, PKCE, and the token exchange.
 */
export class McpingOAuthProvider implements OAuthClientProvider {
  private readonly store: EncryptedKvStore;
  private readonly openBrowser: (url: string) => Promise<void> | void;
  private readonly loopback: HttpServer;
  private readonly port: number;
  private pending: { resolve: (params: URLSearchParams) => void } | null = null;

  private constructor(options: {
    store: EncryptedKvStore;
    openBrowser: (url: string) => Promise<void> | void;
    loopback: HttpServer;
    port: number;
  }) {
    this.store = options.store;
    this.openBrowser = options.openBrowser;
    this.loopback = options.loopback;
    this.port = options.port;
  }

  static create(options: {
    serverId: string;
    openBrowser: (url: string) => Promise<void> | void;
  }): Promise<McpingOAuthProvider> {
    const store = new EncryptedKvStore(serverDir(options.serverId));
    // Bind the loopback before the provider is used: `clientMetadata`
    // (redirect_uris) is read during registration, before the redirect.
    // biome-ignore lint/complexity/useMaxParams: Promise executor is (resolve, reject).
    return new Promise((resolve, reject) => {
      const loopback = createServer();
      loopback.once('error', reject);
      loopback.listen(0, '127.0.0.1', () => {
        const { port } = loopback.address() as AddressInfo;
        const provider = new McpingOAuthProvider({
          store,
          openBrowser: options.openBrowser,
          loopback,
          port,
        });
        // biome-ignore lint/complexity/useMaxParams: node http request handler is (req, res).
        loopback.on('request', (req, res) => {
          const url = new URL(req.url ?? '/', 'http://127.0.0.1');
          if (url.pathname === CALLBACK_PATH && url.searchParams.has('code')) {
            res.writeHead(HTTP_OK, { 'content-type': 'text/html' }).end(CALLBACK_PAGE);
            const settle = provider.pending;
            provider.pending = null;
            settle?.resolve(url.searchParams);
            return;
          }
          res.writeHead(HTTP_NOT_FOUND).end();
        });
        resolve(provider);
      });
    });
  }

  get redirectUrl(): string {
    return `http://127.0.0.1:${this.port}${CALLBACK_PATH}`;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: CLIENT_NAME,
      client_uri: CLIENT_URI,
      redirect_uris: [this.redirectUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'native',
    };
  }

  clientInformation(): StoredOAuthClientInformation | undefined {
    const raw = this.store.get(CLIENT_INFO_KEY);
    return raw ? (JSON.parse(raw) as StoredOAuthClientInformation) : undefined;
  }

  saveClientInformation(info: StoredOAuthClientInformation): void {
    this.store.set(CLIENT_INFO_KEY, JSON.stringify(info));
  }

  tokens(): StoredOAuthTokens | undefined {
    const raw = this.store.get(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as StoredOAuthTokens) : undefined;
  }

  saveTokens(tokens: StoredOAuthTokens): void {
    this.store.set(TOKENS_KEY, JSON.stringify(tokens));
  }

  saveCodeVerifier(codeVerifier: string): void {
    this.store.set(CODE_VERIFIER_KEY, codeVerifier);
  }

  codeVerifier(): string {
    const value = this.store.get(CODE_VERIFIER_KEY);
    if (!value) {
      throw new Error('Missing PKCE code verifier');
    }
    return value;
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    await this.openBrowser(authorizationUrl.toString());
  }

  /** Resolves with the callback query params once the browser redirect lands. */
  awaitCallback(): Promise<URLSearchParams> {
    return new Promise((resolve) => {
      this.pending = { resolve };
    });
  }

  dispose(): void {
    this.pending = null;
    this.loopback.close();
  }
}

export function hasOauthTokens(serverId: string): boolean {
  const store = new EncryptedKvStore(serverDir(serverId));
  const raw = store.get(TOKENS_KEY);
  if (!raw) {
    return false;
  }
  try {
    return Boolean((JSON.parse(raw) as { access_token?: string }).access_token);
  } catch {
    return false;
  }
}

export function clearOauth(serverId: string): void {
  rmSync(serverDir(serverId), { recursive: true, force: true });
}
