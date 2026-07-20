# mcping

The main app: a macOS menu-bar Electron app that connects to MCP servers over
Streamable HTTP and shows the notifications they send as native macOS
notifications. Built with [electron-vite](https://electron-vite.org).

mcping only **displays** notifications — it never runs actions on a server's
behalf. That boundary is the security model; keep it.

## Layout

- **`src/main/`** — Electron main process. `index.ts` (entry/lifecycle),
  `ipc.ts` (renderer↔main IPC registry). Subfolders:
  - `auth/` — OAuth flow (`oauth.ts`) and keychain encrypt/decrypt (`secret-cipher.ts`).
  - `stores/` — `electron-store` persistence: `settings-store.ts`, `secret-store.ts`.
  - `mcp/` — `listener.ts` (connection lifecycle), `notification-handler.ts` (MCP notification → native notification).
  - `ui/` — `settings-window.ts`, `tray.ts`, `tray-icon.ts`, `renderer-events.ts` (main→renderer push).
  - `system/` — `login-item.ts`, `logger.ts`.
- **`src/shared/`** — cross-process types/constants split by domain (`app`,
  `auth`, `server`, `settings`, `connection`, `log`, `ipc`, `api`); replaces the
  former single `types.ts`.
- **`src/renderer/src/`** — settings UI: `main.ts` (bootstrap), `server-card.ts`,
  `server-auth.ts`, `settings.ts`, `log-panel.ts`, `dom.ts`, `api.ts`.
- **`src/preload/`** — contextBridge exposing `McpingApi`.

## Authentication

Servers may require credentials (`bearer`, `header`, or `oauth`). Two invariants
to keep: **secrets never reach the renderer** (settings the renderer reads carry
only the `auth` descriptor and a `ServerAuthState` boolean, never the value), and
**only a user-initiated Connect may open the browser** — automatic reconnects
surface "authorization required" instead of hijacking it.

Monorepo-wide conventions live in the [root AGENTS.md](../../AGENTS.md).
