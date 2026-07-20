import { safeStorage } from 'electron';

// Every credential mcping persists — static tokens, custom-header values, and
// OAuth tokens — is encrypted through Electron's safeStorage, which is backed by
// the macOS Keychain. We only ever write the resulting ciphertext to disk.

export function isSecretStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function encryptSecret(value: string): string {
  return safeStorage.encryptString(value).toString('base64');
}

export function decryptSecret(encoded: string): string {
  return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
}
