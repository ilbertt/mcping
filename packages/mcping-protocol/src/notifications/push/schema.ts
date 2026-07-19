import { NotificationSchema } from '@modelcontextprotocol/core';
import { z } from 'zod';
import { MCPING_METHODS } from '#notifications/methods.ts';

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
