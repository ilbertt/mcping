import { NotificationSchema } from '@modelcontextprotocol/core';
import { z } from 'zod';
import { MCPING_METHODS } from '#methods.ts';

/**
 * Priority hint, mapped to the platform's native urgency where supported
 * (e.g. Linux) and ignored elsewhere (e.g. macOS).
 */
export const McpingPushPrioritySchema = z.enum(['low', 'normal', 'critical']);
export type McpingPushPriority = z.infer<typeof McpingPushPrioritySchema>;

export const McpingPushParamsSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  /** macOS only. */
  subtitle: z.string().optional(),
  priority: McpingPushPrioritySchema.optional(),
  silent: z.boolean().optional(),
});
export type McpingPushParams = z.infer<typeof McpingPushParamsSchema>;

export const McpingPushNotificationSchema = NotificationSchema.extend({
  method: z.literal(MCPING_METHODS.push),
  params: McpingPushParamsSchema,
});
export type McpingPushNotification = z.infer<typeof McpingPushNotificationSchema>;

/**
 * Build a push notification for a server to emit. Pass the result to your MCP
 * SDK's notification API. Throws if `params` is invalid.
 */
export function buildPushNotification(params: McpingPushParams): McpingPushNotification {
  return McpingPushNotificationSchema.parse({ method: MCPING_METHODS.push, params });
}

/**
 * Parse a received notification as a push, returning its params or `null` if it
 * is not a valid push.
 */
export function parsePushNotification(notification: unknown): McpingPushParams | null {
  const result = McpingPushNotificationSchema.safeParse(notification);
  return result.success ? result.data.params : null;
}
