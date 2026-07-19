# @repo/mcping-protocol

The server → client notification contract for mcping: method-name constants,
types, zod schemas, and a build/parse pair for both sides of the wire.

Internal-only for now (no `pkg/`). It's written to be published later without
rework — senders `buildMcpingNotification`, receivers `parseMcpingNotification`.

## The contract

Each notification kind is its own JSON-RPC method under the `notifications/`
prefix, mirroring MCP's built-in notifications:

| Method | Status | Payload |
| --- | --- | --- |
| `notifications/mcping/push` | implemented | `{ title, body?, subtitle?, priority?, silent? }` |
| `notifications/mcping/action` | reserved (parked) | — |

`push` is purely presentational; `priority` (`low` \| `normal` \| `critical`)
is a hint mapped to the platform's native urgency where supported. A wire
message (the transport adds `jsonrpc`, never an `id`):

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/mcping/push",
  "params": { "title": "Deploy finished", "body": "prod #4821 in 3m12s" }
}
```

## Usage

```ts
// Sender: construct + validate one, then hand it to your MCP SDK's notify API.
import { buildMcpingNotification, MCPING_METHODS } from '@repo/mcping-protocol';
const { method, params } = buildMcpingNotification({
  method: MCPING_METHODS.push,
  params: { title: 'Deploy finished' },
});

// Receiver: parse whatever arrives on the notification channel.
import { MCPING_METHODS, parseMcpingNotification } from '@repo/mcping-protocol';
const parsed = parseMcpingNotification(notification);
if (parsed?.method === MCPING_METHODS.push) showNativeNotification(parsed.params);
```

The zod schemas (`McpingPushParamsSchema`, `McpingPushNotificationSchema`) are
exported too, for callers that want `safeParse`/custom error handling.

Built on [`@modelcontextprotocol/core`](https://www.npmjs.com/package/@modelcontextprotocol/core)
(the spec's public zod schemas); `McpingPushNotificationSchema` extends its
`NotificationSchema`.

## Dev

- `bun run check:types` — type-check the package.

Source layout: everything lives under `notifications/` — `methods.ts` (method
names), `schema.ts` (the discriminated union of all kinds), `build.ts` (construct
+ validate) and `parse.ts` (validate incoming) over that union, plus one
`schema.ts` per kind (`push/`). `index.ts` is the only re-export barrel.
