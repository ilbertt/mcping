# demo

Ping [mcping](../mcping) from your terminal. This is a tiny local MCP
server that turns whatever you type into a notification mcping shows — the whole
loop end-to-end, without having to write your own MCP server.

## 1. Build and open mcping

Every command here uses Bun's `--filter`, which finds the workspace root on its
own — run them from **any** directory in the repo, no `cd` needed.

```sh
bun install                                # first time only
bun run --filter @repo/mcping release
```

`release` builds mcping first, then packages it, so this one command is all you
need. Open the result:

```sh
open apps/mcping/release/mac-arm64/mcping.app
```

mcping lives in the menu bar. It auto-connects to `http://127.0.0.1:3050/mcp` —
the address this demo server listens on — so leave its default server enabled.
Allow notifications if macOS asks (push notifications are presentational, so no
Accessibility permission is needed).

## 2. Start the demo server

```sh
bun run --filter @repo/demo server
```

It listens on `http://127.0.0.1:3050/mcp`. mcping connects within a second — watch
its menu-bar **MCP servers** submenu turn *connected* (it also retries with
backoff, so starting the server before or after the app both work).

### Requiring authentication (optional)

By default the server is open. Pass `--auth` to make it require credentials — a
quick way to exercise mcping's auth flows end-to-end:

```sh
bun run --filter @repo/demo server --auth apikey   # random API key
bun run --filter @repo/demo server --auth oauth    # local OAuth server
```

- **`apikey`** prints a random key (a `crypto.randomUUID()`) on startup. In
  mcping, open the server's auth settings, choose the **X-API-Key** header, and
  paste the key.
- **`oauth`** starts a throwaway local authorization server on
  `http://127.0.0.1:3051`. In mcping, set the auth type to **OAuth** and click
  **Connect**; your browser opens briefly to complete authorization and the token
  flows back automatically. It verifies nothing and protects nothing — it exists
  only to drive mcping's OAuth path locally.

## 3. Ping yourself

At the `> ` prompt, type a message and press Enter:

```
> Deploy finished — take a look
>
```

Each line becomes a **push** notification; mcping shows it as a native system
notification with your text as the title.

## How it works

The server and mcping share one contract —
[`@repo/mcping-protocol`](../../packages/mcping-protocol). `src/server.ts` builds a
push notification with that package's `buildPushNotification` helper and sends it
over its MCP notification channel; mcping validates the same schema with
`parseMcpingNotification` and shows a native system notification.

The wire message (the transport adds `jsonrpc`):

```jsonc
{
  "jsonrpc": "2.0",
  "method": "notifications/mcping/push",
  "params": { "title": "Deploy finished — take a look" }
}
```

`push` is presentational. Alongside `title` it also carries an optional `body`,
`subtitle`, `priority` (`low` | `normal` | `critical`), and `silent` — the demo
sends only the title; see [`src/server.ts`](./src/server.ts) to send the rest.
