# mcping

The main app: a macOS menu-bar Electron app that connects to MCP servers over
Streamable HTTP and shows the notifications they send as native macOS
notifications. Built with [electron-vite](https://electron-vite.org).

mcping only **displays** notifications — it never runs actions on a server's
behalf. That boundary is the security model; keep it.

Monorepo-wide conventions live in the [root AGENTS.md](../../AGENTS.md).
