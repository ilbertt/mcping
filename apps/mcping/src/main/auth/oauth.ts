import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { auth, type KVStore, NodeOAuthClientProvider } from 'mcp-use/auth/node';
import { decryptSecret, encryptSecret } from '#main/auth/safe-storage.ts';

const OAUTH_DIR = 'oauth';
const CLIENT_NAME = 'mcping';
const CLIENT_URI = 'https://github.com/ilbertt/mcping';
const FILE_MODE = 0o600;
const DIR_MODE = 0o700;
const STORE_SUFFIX = '.bin';
const TOKENS_KEY_MARKER = 'tokens';

function serverDir(serverId: string): string {
  return join(app.getPath('userData'), OAUTH_DIR, serverId);
}

function encodeKey(key: string): string {
  return Buffer.from(key).toString('base64url');
}

function decodeKey(name: string): string {
  return Buffer.from(name, 'base64url').toString('utf8');
}

// Keychain-encrypted, file-backed KVStore for the OAuth session the SDK owns
// (client registration, PKCE verifier, tokens, loopback port). One directory per
// server so removing a server is a clean `rm -rf`, and every value on disk is
// ciphertext rather than a plaintext token.
class EncryptedKvStore implements KVStore {
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
      return decryptSecret(readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  }

  // biome-ignore lint/complexity/useMaxParams: KVStore.set(key, value) is the mcp-use interface signature.
  set(key: string, value: string): void {
    mkdirSync(this.dir, { recursive: true, mode: DIR_MODE });
    const file = this.fileFor(key);
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, encryptSecret(value), { mode: FILE_MODE });
    renameSync(tmp, file);
  }

  remove(key: string): void {
    const file = this.fileFor(key);
    if (existsSync(file)) {
      unlinkSync(file);
    }
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

export function createOauthProvider(options: {
  serverId: string;
  url: string;
  openBrowser: (url: string) => Promise<void> | void;
}): Promise<NodeOAuthClientProvider> {
  return NodeOAuthClientProvider.create(options.url, {
    kvStore: new EncryptedKvStore(serverDir(options.serverId)),
    clientName: CLIENT_NAME,
    clientUri: CLIENT_URI,
    openBrowser: options.openBrowser,
  });
}

// Exchange the captured authorization code for tokens and persist them via the
// provider's store. Discovery falls back to the server's default well-known
// resource-metadata path, which covers spec-compliant servers.
export async function completeAuthorization(options: {
  provider: NodeOAuthClientProvider;
  url: string;
  code: string;
}): Promise<void> {
  await auth(options.provider, { serverUrl: options.url, authorizationCode: options.code });
}

function tokensJsonHasAccess(raw: string): boolean {
  try {
    return Boolean((JSON.parse(raw) as { access_token?: string }).access_token);
  } catch {
    return false;
  }
}

export function hasOauthTokens(serverId: string): boolean {
  const store = new EncryptedKvStore(serverDir(serverId));
  for (const key of store.keys()) {
    if (!key.includes(TOKENS_KEY_MARKER)) {
      continue;
    }
    const raw = store.get(key);
    if (raw && tokensJsonHasAccess(raw)) {
      return true;
    }
  }
  return false;
}

export function clearOauth(serverId: string): void {
  rmSync(serverDir(serverId), { recursive: true, force: true });
}
