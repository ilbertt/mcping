// How mcping authenticates to a server. Secret material (bearer token, header
// value, OAuth tokens) is never part of this descriptor — it lives encrypted in
// the OS keychain and never reaches the renderer.
export type ServerAuth =
  | { type: 'none' }
  | { type: 'bearer' }
  | { type: 'header'; name: string }
  | { type: 'oauth' };

export type ServerAuthType = ServerAuth['type'];

export const DEFAULT_HEADER_NAME = 'X-API-Key';

// Whether a server's credential is in place, for the renderer to reflect
// ("Token saved ✓" / "Signed in ✓") without ever seeing the secret itself.
export interface ServerAuthState {
  secretSet: boolean;
  oauthAuthorized: boolean;
}
