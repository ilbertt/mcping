# mcping

The main app: a macOS menu-bar Electron app that connects to MCP servers over
Streamable HTTP and shows the notifications they send as native macOS
notifications. Built with [electron-vite](https://electron-vite.org).

mcping only **displays** notifications — it never runs actions on a server's
behalf. That boundary is the security model; keep it.

## Authentication

Servers may require credentials (`bearer`, `header`, or `oauth`); the code lives
in `src/main/auth/`. Two invariants to keep: **secrets never reach the
renderer** (settings the renderer reads carry only the `auth` descriptor and a
`ServerAuthState` boolean, never the value), and **only a user-initiated Connect
may open the browser** — automatic reconnects surface "authorization required"
instead of hijacking it.

Monorepo-wide conventions live in the [root AGENTS.md](../../AGENTS.md).
