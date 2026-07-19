import type { McpingPushNotification } from '#push.ts';
import { McpingPushNotificationSchema } from '#push.ts';

/**
 * Any recognized mcping notification, discriminated by its `method` literal.
 * Becomes a `z.discriminatedUnion('method', …)` as more kinds (e.g. actions)
 * are added.
 */
export type McpingNotification = McpingPushNotification;

/**
 * Parse any received notification into a recognized mcping notification, or
 * `null` if it is not one.
 */
export function parseMcpingNotification(notification: unknown): McpingNotification | null {
  const result = McpingPushNotificationSchema.safeParse(notification);
  return result.success ? result.data : null;
}
