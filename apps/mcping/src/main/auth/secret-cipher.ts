import { safeStorage } from 'electron';

// safeStorage-backed (macOS Keychain); only the resulting base64 ciphertext is
// ever written to disk, never the raw secret.
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
