import { safeStorage } from 'electron';

// Encrypts and decrypts secret strings through Electron's safeStorage, which is
// backed by the macOS Keychain. Only the resulting base64 ciphertext is ever
// written to disk. Stateless — shared as a singleton.
class SecretCipher {
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  encrypt(value: string): string {
    return safeStorage.encryptString(value).toString('base64');
  }

  decrypt(encoded: string): string {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
  }
}

export const secretCipher = new SecretCipher();
