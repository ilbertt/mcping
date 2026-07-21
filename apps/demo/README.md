# demo

A tiny local MCP server that pushes [mcping](../mcping) notifications over the
upcoming **MCP 2026-07-28** (stateless) protocol — the whole extension flow
end-to-end.

> **`beta` branch.** `main` runs the stable `mcp-use@1` demo. This branch serves
> 2026-07-28 and delivers pushes through the mcping extension's
> `subscriptions/listen` subscription. See [Design notes](#design-notes) for why
> it's hand-wired on the raw SDK.

## The flow

1. A client calls `server/discover` and sees the server advertises the
   `io.github.ilbertt/mcping` extension in `capabilities.extensions`.
2. The client opens a `subscriptions/listen` stream with the mcping opt-in
   (`{ "notifications": { "push": true } }`).
3. The server acknowledges, then pushes `notifications/mcping/push` frames on
   that long-lived stream. The client stays **display-only** — it never calls a
   tool.

Each line you type in the server terminal becomes a push to every subscriber.

## Run it

```sh
bun install                          # first time only
bun run --filter @repo/demo server
```

Listens on `http://127.0.0.1:3050/mcp`. Try it with curl:

```sh
# server/discover → advertises the extension
curl -s http://127.0.0.1:3050/mcp -H 'content-type: application/json' \
  -H 'mcp-method: server/discover' \
  -d '{"jsonrpc":"2.0","id":"d","method":"server/discover","params":{}}'

# subscribe (streams the ack, then pushes as you type in the server terminal)
curl -sN http://127.0.0.1:3050/mcp -H 'content-type: application/json' \
  -H 'mcp-method: subscriptions/listen' \
  -d '{"jsonrpc":"2.0","id":"sub-1","method":"subscriptions/listen","params":{"notifications":{"push":true}}}'
```

## The contract

The server and mcping share one contract —
[`@repo/mcping-protocol`](../../packages/mcping-protocol). The server builds each
push with `buildMcpingNotification`; a client validates it with
`parseMcpingNotification`. The subscription opt-in field (`{ push: true }`) and
the extension identity also live there. The wire frame on the listen stream:

```jsonc
{
  "jsonrpc": "2.0",
  "method": "notifications/mcping/push",
  "params": {
    "title": "Deploy finished",
    "body": "prod #4821",
    "_meta": { "io.modelcontextprotocol/subscriptionId": "sub-1" }
  }
}
```

---

## Design notes

Why hand-wired instead of a server framework:

- The mcping extension delivers pushes the way Tasks delivers `notifications/tasks`:
  an extension merges its own field into the `subscriptions/listen` filter (the
  **Subscription Additions** pattern), and the server pushes the extension's
  notification on that stream. This is spec-supported (2026-07-28) and keeps a
  display-only client passive — no tool call.
- But **no server library at this beta stage can publish a custom notification on
  a `subscriptions/listen` stream.** `@modelcontextprotocol/server`'s
  `createMcpHandler` owns that stream and drives it from a **closed four-event
  bus** (`tools/prompts/resources` list-changed + `resource_updated`); mcp-use@beta
  exposes only the same four `notify*` methods. There is no seam for a custom
  event.
- The v2 **client** SDK, by contrast, fully supports it (`client.listen()` +
  `setNotificationHandler`) — which is what [`apps/mcping`](../mcping) uses.

So this server hand-drives the listen stream itself on top of
`@modelcontextprotocol/server` (its meta-key constants + the 2026-07-28-capable
build): it declares the extension in `server/discover`, and on a
`subscriptions/listen` with `{ push: true }` it acknowledges and streams
`notifications/mcping/push` frames (subscription-id tagged, keep-alive'd). It's a
minimal spike — the honest way to demonstrate the extension's subscription push
until a server framework exposes custom subscription notifications.

> The published `@modelcontextprotocol/server@beta` on npm is still 2025-era
> (`LATEST_PROTOCOL_VERSION = 2025-11-25`); only the `pkg.pr.new` preview build
> serves 2026-07-28, so that's what this app pins.
