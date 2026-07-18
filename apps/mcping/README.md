# mcping

**Let MCP servers ping you.** A macOS menu-bar app that connects to a remote
[MCP](https://modelcontextprotocol.io) server over Streamable HTTP, listens for a
custom notification, and — with your approval — opens your AI desktop app (Claude
Desktop by default) in a new chat pre-filled with the notification's text.

Built with [Electron](https://www.electronjs.org/) and
[electron-vite](https://electron-vite.org/). It lives in the menu bar only — no
Dock icon, no window until you open Settings.

## Requirements

- macOS
- [Bun](https://bun.sh)
- An AI desktop app to drive (Claude Desktop by default; configurable by name)

## Setup

From the repo root:

```sh
bun install
```

Electron 42+ no longer downloads its binary from its own `postinstall` (a
supply-chain hardening change), so this package runs
[`install-electron`](https://www.electronjs.org/blog/electron-42-0) in its
`postinstall` to provision it. If Electron ever looks missing, re-run
`bun install --filter @repo/mcping` or `bunx install-electron` inside `apps/mcping`.

## Develop

```sh
bun run --filter @repo/mcping dev
```

A menu-bar icon appears (labelled `mcping` next to the placeholder icon). Use its
menu to Connect/Disconnect, run a Test action, or open Settings.

## How it works

1. It connects to the configured MCP server (`http://127.0.0.1:3050/mcp` by
   default) and keeps the Streamable-HTTP stream open, reconnecting with backoff.
2. When a notification arrives whose method matches `notificationMethod`
   (`custom/test` by default), it reads the `text` param.
3. If **Ask for approval** is on (default), it posts a clickable system
   notification; clicking it runs the action. If off, it runs immediately.
4. It copies the text to the clipboard and drives the target app via AppleScript:
   Cmd+N for a new chat, clicks the real **Edit ▸ Paste** menu item, and
   optionally presses Return (when **Send automatically** is on).

## Permissions

Driving another app requires the macOS **Accessibility** permission. The app
prompts for it on first launch; you can also grant it from **System Settings ▸
Privacy & Security ▸ Accessibility** (the Settings window has a shortcut button).

The permission is tied to the app bundle's signature, so the dev/unsigned build
and a signed release are granted **separately** — re-grant after installing a
signed build, and **restart the app** after granting.

## Package

```sh
bun run --filter @repo/mcping release
```

Produces a DMG and zip in `apps/mcping/release/`. Configuration lives in
[`release.ts`](./release.ts) (typed via electron-builder's programmatic API).

Signing and notarization are gated behind env vars — without them you get an
**unsigned** build for local testing. Set these in CI for a signed + notarized
release:

| Variable | Purpose |
| --- | --- |
| `CSC_LINK`, `CSC_KEY_PASSWORD` | Developer ID certificate (signing) |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | Notarization |

A signed + notarized DMG gives the one-click "downloaded from the internet"
prompt; an unsigned one hits the "cannot check for malicious software" wall.

## Notes

- **Tray icon:** `resources/iconTemplate.png` (+ `@2x`) is a monochrome "ping"
  (broadcast waves) glyph. As a macOS template image it adapts to light/dark
  menu bars automatically.
- **Not just Claude:** the driver targets an app by name and uses generic
  new-chat + paste steps, so it can point at Codex or other AI desktop apps
  later — set the app name in Settings. Menu labels (`Edit`/`Paste`) assume
  English; the driver accepts overrides.
