import { type McpingNotification, McpingNotificationSchema } from '#notifications/schema.ts';

/**
 * Validate a notification you have constructed and return it typed. The input is
 * typed as the discriminated union, so the right `params` for the `method` is
 * enforced at compile time; the runtime check catches value-level issues (e.g.
 * an empty `title`). Throws on invalid — use it for your own outgoing messages,
 * where a mistake should surface loudly. Pass the result to your MCP SDK's
 * notification API.
 */
export function buildMcpingNotification(notification: McpingNotification): McpingNotification {
  return McpingNotificationSchema.parse(notification);
}
