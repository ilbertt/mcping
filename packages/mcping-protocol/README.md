# @repo/mcping-protocol

The server → client notification contract for mcping: method-name constants,
types, zod schemas, and builders/parsers for both sides of the wire.

Internal-only for now (no `pkg/`). It's written to be published later without
rework — server authors would `buildPush`, clients `parseMcpingNotification`.

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
// Server: construct one, then hand it to your MCP SDK's notification API.
import { buildPushNotification } from '@repo/mcping-protocol';
const { method, params } = buildPushNotification({ title: 'Deploy finished' });

// Client: parse whatever arrives on the notification channel.
import { parseMcpingNotification } from '@repo/mcping-protocol';
const parsed = parseMcpingNotification(notification);
if (parsed?.kind === 'push') showNativeNotification(parsed.params);
```

The zod schemas (`McpingPushParamsSchema`, `McpingPushNotificationSchema`) are
exported too, for callers that want `safeParse`/custom error handling.

Built on [`@modelcontextprotocol/core`](https://www.npmjs.com/package/@modelcontextprotocol/core)
(the spec's public zod schemas); `McpingPushNotificationSchema` extends its
`NotificationSchema`.

## Dev

- `bun run check:types` — type-check the package.

Source layout: `methods.ts` (method names) · `push.ts` (push schema + build/parse)
· `parse.ts` (top-level dispatcher) · `index.ts` (the only re-export barrel).
