import { z } from 'zod';
import { McpingPushNotificationSchema } from '#notifications/push/schema.ts';

/**
 * Every recognized mcping notification, discriminated by its `method` literal.
 * Each kind's notification schema joins this union as it lands (e.g. actions).
 */
export const McpingNotificationSchema = z.discriminatedUnion('method', [
  McpingPushNotificationSchema,
]);
export type McpingNotification = z.infer<typeof McpingNotificationSchema>;
