import { z } from 'zod';

/**
 * The mcping extension's reverse-DNS identifier. `io.github.ilbertt` reverses
 * the GitHub Pages domain `ilbertt.github.io`; `mcping` is the extension name.
 * Per the MCP 2026-07-28 `_meta` key naming rules (spec `basic/index#meta`,
 * SEP-2133), a prefix is reserved for MCP only when its SECOND label is
 * `modelcontextprotocol` or `mcp`. Here the second label is `github`, so this is
 * a valid, non-reserved third-party identifier.
 */
export const MCPING_EXTENSION_ID = 'io.github.ilbertt/mcping';

/**
 * The fields the mcping extension merges into the `subscriptions/listen` request
 * filter, mirroring how the Tasks extension adds `taskIds` (SEP-2663). A client
 * includes `push: true` to opt into `notifications/mcping/push` on that stream;
 * the server echoes the honored fields in
 * `notifications/subscriptions/acknowledged`. This is what lets mcping deliver
 * pushes over the long-lived listen stream instead of inline on a request — so a
 * display-only client receives them without ever calling a tool.
 */
export const McpingSubscriptionFilterSchema = z.object({ push: z.boolean().optional() });
export type McpingSubscriptionFilter = z.infer<typeof McpingSubscriptionFilterSchema>;

/** The filter a client passes to `subscriptions/listen` to receive mcping pushes. */
export const MCPING_SUBSCRIPTION_FILTER: McpingSubscriptionFilter = { push: true };

/**
 * The entry a server advertises in `ServerCapabilities.extensions` (surfaced via
 * `server/discover`) to declare mcping support, mirroring how Tasks advertises
 * `io.modelcontextprotocol/tasks`. An empty settings object means "supported,
 * no settings".
 */
export const MCPING_EXTENSION_CAPABILITY: Readonly<Record<string, Record<string, never>>> = {
  [MCPING_EXTENSION_ID]: {},
};
