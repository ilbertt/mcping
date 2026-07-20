# mcping

The main app: a macOS menu-bar Electron app that connects to MCP servers over
Streamable HTTP and shows the notifications they send as native macOS
notifications. Built with [electron-vite](https://electron-vite.org).

mcping only **displays** notifications — it never runs actions on a server's
behalf. That boundary is the security model; keep it.

## Authentication

Servers may require credentials. Each `McpServer` carries an `auth` descriptor
(`none` | `bearer` | `header` | `oauth`); the code lives in `src/main/auth/`:

- **Static credentials** (`bearer`, `header`) — the secret is entered once and
  kept in `secret-store.ts`, encrypted via `safe-storage.ts` (Electron
  `safeStorage`, Keychain-backed). `mcp-listener.ts` reads it at connect time
  and hands mcp-use an `authToken` or a custom header.
- **OAuth 2.1** (`oauth`) — `oauth.ts` wraps mcp-use's `NodeOAuthClientProvider`
  (browser + loopback redirect, dynamic client registration, PKCE, refresh). Its
  session (client registration, tokens, PKCE verifier) is persisted through an
  `EncryptedKvStore`, so nothing OAuth-related touches disk in plaintext either.

Two invariants to keep: **secrets never reach the renderer** (settings the
renderer reads carry only the `auth` descriptor and a `ServerAuthState` boolean,
never the value), and **only a user-initiated Connect may open the browser** —
automatic reconnects surface "authorization required" instead of hijacking it.

Monorepo-wide conventions live in the [root AGENTS.md](../../AGENTS.md).
