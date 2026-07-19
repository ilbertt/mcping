import { type McpingNotification, McpingNotificationSchema } from '#notifications/schema.ts';

/**
 * Parse any received notification into a recognized mcping notification, or
 * `null` if it is not one. The discriminated union dispatches on `method` and
 * validates the params in one pass.
 */
export function parseMcpingNotification(notification: unknown): McpingNotification | null {
  const result = McpingNotificationSchema.safeParse(notification);
  return result.success ? result.data : null;
}
