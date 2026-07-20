import Store from 'electron-store';
import { secretCipher } from '#main/auth/secret-cipher.ts';

interface SecretStoreShape {
  secrets: Record<string, string>;
}

// Static credentials (bearer token or custom-header value) keyed by server id.
// Kept in a store separate from settings so the plaintext config the renderer
// reads can never carry a secret, and so removing a server is a clean delete.
// Values are keychain-encrypted ciphertext, never the raw secret.
class SecretStore {
  private instance: Store<SecretStoreShape> | null = null;

  private get store(): Store<SecretStoreShape> {
    this.instance ??= new Store<SecretStoreShape>({ name: 'secrets', defaults: { secrets: {} } });
    return this.instance;
  }

  get(id: string): string | null {
    const encoded = this.store.get('secrets')[id];
    if (!encoded) {
      return null;
    }
    try {
      return secretCipher.decrypt(encoded);
    } catch {
      return null;
    }
  }

  set(options: { id: string; secret: string }): void {
    if (!secretCipher.isAvailable()) {
      throw new Error('Encrypted secret storage is unavailable on this system');
    }
    this.store.set('secrets', {
      ...this.store.get('secrets'),
      [options.id]: secretCipher.encrypt(options.secret),
    });
  }

  clear(id: string): void {
    const secrets = { ...this.store.get('secrets') };
    delete secrets[id];
    this.store.set('secrets', secrets);
  }

  has(id: string): boolean {
    return Boolean(this.store.get('secrets')[id]);
  }
}

export const secretStore = new SecretStore();
