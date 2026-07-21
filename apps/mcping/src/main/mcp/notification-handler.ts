import type { Notification } from '@modelcontextprotocol/client';
import {
  MCPING_METHODS,
  type McpingPushParams,
  parseMcpingNotification,
} from '@repo/mcping-protocol';
import { Notification as DesktopNotification } from 'electron';
import { log } from '#main/system/logger.ts';
import type { McpServer } from '#shared/server.ts';

// `priority` is named to match Electron's `urgency` values.
function showPushNotification(options: { server: McpServer; params: McpingPushParams }): void {
  const { server, params } = options;
  if (!DesktopNotification.isSupported()) {
    log({ level: 'warn', message: `[${server.name}] Native notifications not supported` });
    return;
  }
  new DesktopNotification({
    title: params.title,
    body: params.body,
    subtitle: params.subtitle,
    silent: params.silent,
    urgency: params.priority,
  }).show();
  log({ level: 'info', message: `[${server.name}] Push: ${params.title}` });
}

export function handleNotification(options: {
  notification: Notification;
  server: McpServer;
}): void {
  const { notification, server } = options;
  const parsed = parseMcpingNotification(notification);
  if (parsed?.method === MCPING_METHODS.push) {
    showPushNotification({ server, params: parsed.params });
    return;
  }
  log({ level: 'info', message: `[${server.name}] Ignoring unrecognized notification` });
}
