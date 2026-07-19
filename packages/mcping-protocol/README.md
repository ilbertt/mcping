# @repo/mcping-protocol

The server → client notification contract for mcping: method-name constants,
types, zod schemas, and a build/parse pair for both sides of the wire.

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
import { buildMcpingNotification, MCPING_METHODS } from '@repo/mcping-protocol';

const { method, params } = buildMcpingNotification({
  method: MCPING_METHODS.push,
  params: { title: 'Deploy finished' },
});

// ...

const parsed = parseMcpingNotification(notification);
if (parsed?.method === MCPING_METHODS.push) {
  showNativeNotification(parsed.params);
}
```
