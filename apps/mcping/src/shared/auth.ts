// How mcping authenticates to a server. Secret material (the API-key header
// value, OAuth tokens) is never part of this descriptor — it lives encrypted in
// the OS keychain and never reaches the renderer.
export type ServerAuth = { type: 'none' } | { type: 'header'; name: string } | { type: 'oauth' };

export type ServerAuthType = ServerAuth['type'];

export const DEFAULT_HEADER_NAME = 'X-API-Key';

export interface ServerAuthState {
  secretSet: boolean;
  oauthAuthorized: boolean;
}
