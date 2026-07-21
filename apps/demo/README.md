# demo

A tiny local MCP server that emits [mcping](../mcping) push notifications — the
whole contract end-to-end without writing your own server.

> **`beta` branch.** This build runs on `mcp-use@2` and serves the upcoming
> **MCP 2026-07-28** (stateless) protocol. `main` keeps the stable `mcp-use@1`
> demo. See [Design notes](#design-notes-mcp-2026-07-28) for the spec rationale
> and the current `mcp-use@beta` limitations.

## What changed from `main`

The 2026-07-28 protocol is **stateless**: there are no protocol sessions and no
persistent server→client channel, so `main`'s "type in the terminal → push to
connected clients" loop is no longer expressible. The flow is re-centered on a
tool call: **`run-demo-deploy`** runs a simulated deployment and produces two
mcping `notifications/mcping/push` frames ("started" and "finished").

## Run it

```sh
bun install                          # first time only
bun run --filter @repo/demo server
```

The server listens on `http://127.0.0.1:3050/mcp` and serves protocol
`2026-07-28`. Drive it with any MCP 2026-07-28 client, or over HTTP:

```sh
# server/discover → advertises supportedVersions: ["2026-07-28"]
curl -s http://127.0.0.1:3050/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' -H 'Mcp-Method: server/discover' \
  -d '{"jsonrpc":"2.0","id":"d","method":"server/discover","params":{"_meta":{
       "io.modelcontextprotocol/protocolVersion":"2026-07-28",
       "io.modelcontextprotocol/clientInfo":{"name":"probe","version":"0.0.0"},
       "io.modelcontextprotocol/clientCapabilities":{}}}}'

# tools/call run-demo-deploy → result.structuredContent.pushes = two mcping pushes
curl -s http://127.0.0.1:3050/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' -H 'Mcp-Method: tools/call' -H 'Mcp-Name: run-demo-deploy' \
  -d '{"jsonrpc":"2.0","id":"c","method":"tools/call","params":{"name":"run-demo-deploy",
       "arguments":{"service":"api"},"_meta":{
       "io.modelcontextprotocol/protocolVersion":"2026-07-28",
       "io.modelcontextprotocol/clientInfo":{"name":"probe","version":"0.0.0"},
       "io.modelcontextprotocol/clientCapabilities":{}}}}'
```

Every request on 2026-07-28 carries its own `_meta` envelope
(`io.modelcontextprotocol/protocolVersion` + `clientCapabilities` are required,
`clientInfo` is enforced by `mcp-use`) — there is no `initialize` handshake.

## The contract

The server and mcping share one contract —
[`@repo/mcping-protocol`](../../packages/mcping-protocol). `run-demo-deploy`
builds each push with that package's `buildMcpingNotification`; a client
validates the same schema with `parseMcpingNotification`. The wire frame (the
transport adds `jsonrpc`, never an `id`):

```jsonc
{
  "jsonrpc": "2.0",
  "method": "notifications/mcping/push",
  "params": { "title": "Deployed api", "body": "Deployment finished", "priority": "normal" }
}
```

`push` is presentational: alongside `title` it carries optional `body`,
`subtitle`, `priority` (`low` | `normal` | `critical`), and `silent`.

## Test

```sh
bun test
```

Covers the protocol round-trip/parse, `server/discover` advertising
`2026-07-28`, the extension-id validity, the tool `_meta` association, the
`extensions`-capability gap (as a tripwire), and the end-to-end push validated by
`parseMcpingNotification`.

---

## Design notes (MCP 2026-07-28)

Every decision below traces to the live draft, read at implementation time —
spec index <https://modelcontextprotocol.io/specification/draft>, `_meta`/
extension rules `basic/index#meta` + [extensions/overview](https://modelcontextprotocol.io/extensions/overview),
subscriptions `basic/patterns/subscriptions`, transport
`basic/transports/streamable-http`, and the authoritative
`schema/draft/schema.ts`.

### Resolved versions

- `mcp-use` → **`2.0.0-beta.22`** (the `@beta` dist-tag), pinned exactly in the
  root catalog and `bun.lock` — no floating tag.
- It pulls the split v2 SDK `@modelcontextprotocol/{server,client,core}`
  (`2.0.0-beta.4`), which is ESM-only.

### How 2026-07-28 is enabled

Not a flag — it is what the v2 stack serves. `mcp-use@2` builds a fresh SDK
`McpServer` per request over a session-less Streamable HTTP transport (the
stateless model), so `getHandler()` answers `server/discover` with
`supportedVersions: ["2026-07-28"]` and validates per-request `_meta` envelopes.
Legacy `2025-11-25` traffic is still answered from the same endpoint
(`ServerConfig.legacy`, default `"stateless"`).

### Extension identifier — `io.github.ilbertt/mcping`

Valid and **non-reserved**: an identifier's prefix is reserved for MCP only when
its **second label** is `modelcontextprotocol` or `mcp` (`basic/index#meta`).
Here the labels are `[io, github, ilbertt]` — second label `github` — so it is a
normal third-party ID (`github` reverses the GitHub Pages domain
`ilbertt.github.io`). The rule is encoded and tested in
[`src/extension.ts`](./src/extension.ts) (`isValidThirdPartyExtensionId`). Note
the notification **method** name stays a plain `notifications/…` string
(`notifications/mcping/push`, mirroring Tasks' `notifications/tasks`); reverse-DNS
prefixing applies to identifiers and `_meta`/capability keys, not method names.

### Why the push is delivered inline, not via `subscriptions/listen`

`subscriptions/listen` is **closed**, confirmed from the schema — its
`notifications` parameter is a fixed `SubscriptionFilter` struct with exactly
`toolsListChanged` / `promptsListChanged` / `resourcesListChanged` /
`resourceSubscriptions`, and "the server MUST NOT send notification types the
client has not explicitly requested." There is no open map for a third party to
register `notifications/mcping/push`. The spec-sanctioned alternative
(`basic/transports/streamable-http`, "Receiving Messages") is a **request-scoped
notification on a tool call's own SSE response stream**: the server MAY send
notifications before the final response, and they MUST relate to that request.
So `run-demo-deploy` is the delivery vehicle.

### `mcp-use@beta` limitations (reported, not worked around)

The underlying `@modelcontextprotocol/server` SDK supports both of the following;
`mcp-use@beta`'s wrapper does not surface them, so — per the brief — they are
**reported rather than hacked around**:

1. **No custom `extensions` capability.** `mcp-use` hardcodes its server
   capabilities (`logging`/`tools`/`prompts`/`resources`) with no config
   passthrough, so `io.github.ilbertt/mcping` cannot appear in `server/discover`.
   Verified on the wire (the `KNOWN GAP` test asserts `capabilities.extensions`
   is absent, as a tripwire). The intended declaration lives in
   [`src/extension.ts`](./src/extension.ts) (`MCPING_EXTENSION_CAPABILITY`) and is
   mirrored onto the tool's vendor-namespaced `_meta` — the closest
   spec-legitimate surface `mcp-use` does expose.
2. **No generic notification sender.** The per-request context exposes only
   `reportProgress` (`notifications/progress`) and `sendLog`
   (`notifications/message`); there is no `sendNotification(method, params)`, so
   the exact `notifications/mcping/push` frame cannot be put on the wire. The demo
   therefore builds the two real pushes with `@repo/mcping-protocol`, streams the
   milestones via `reportProgress` (the spec-sanctioned inline channel), and
   returns the built frames in `structuredContent` so a client validates them
   with `parseMcpingNotification`. The build→wire→parse contract runs end to end;
   only the final custom-method frame emission is blocked.

Consequence: because the stateless model removed protocol sessions and
`mcp-use@beta` removed `sendNotification` / `getActiveSessions` / `server.app`,
`main`'s unsolicited-broadcast demo and its `--auth` modes don't port as-is; auth
is deferred on this spike (`main` keeps it).
