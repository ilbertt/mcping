import Store from 'electron-store';
import { decryptSecret, encryptSecret, isSecretStorageAvailable } from '#main/auth/safe-storage.ts';

// Static credentials (bearer token or custom-header value) keyed by server id.
// Kept in a store separate from settings so the plaintext config the renderer
// reads can never carry a secret, and so removing a server is a clean delete.
// Values are keychain-encrypted ciphertext, never the raw secret.
interface SecretStore {
  secrets: Record<string, string>;
}

let store: Store<SecretStore> | null = null;

function requireStore(): Store<SecretStore> {
  if (!store) {
    store = new Store<SecretStore>({ name: 'secrets', defaults: { secrets: {} } });
  }
  return store;
}

export function getSecret(id: string): string | null {
  const encoded = requireStore().store.secrets[id];
  if (!encoded) {
    return null;
  }
  try {
    return decryptSecret(encoded);
  } catch {
    return null;
  }
}

export function setSecret(options: { id: string; secret: string }): void {
  if (!isSecretStorageAvailable()) {
    throw new Error('Encrypted secret storage is unavailable on this system');
  }
  const secrets = { ...requireStore().store.secrets, [options.id]: encryptSecret(options.secret) };
  requireStore().set('secrets', secrets);
}

export function clearSecret(id: string): void {
  const secrets = { ...requireStore().store.secrets };
  delete secrets[id];
  requireStore().set('secrets', secrets);
}

export function hasSecret(id: string): boolean {
  return Boolean(requireStore().store.secrets[id]);
}
