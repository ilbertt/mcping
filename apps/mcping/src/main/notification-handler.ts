import type { Notification } from 'mcp-use/client';
import { checkAccessibility } from '#main/accessibility.ts';
import { openClaudeDesktopWithText } from '#main/claude-desktop.ts';
import { log } from '#main/logger.ts';
import { getSettings } from '#main/settings-store.ts';

const TEST_ACTION_TEXT =
  'mcping test action 👋\nIf you can read this, the Claude Desktop driver works.';

interface NotificationParams {
  text?: string;
  timestamp?: string;
}

async function driveClaude(options: {
  text: string;
  autoSend: boolean;
  appName: string;
}): Promise<void> {
  try {
    await openClaudeDesktopWithText(options);
    log({ level: 'info', message: 'Opened Claude Desktop with notification text' });
  } catch (error) {
    log({ level: 'error', message: `Failed to drive Claude Desktop: ${String(error)}` });
  }
}

export function handleNotification(notification: Notification): void {
  const settings = getSettings();
  if (notification.method !== settings.notificationMethod) {
    log({ level: 'info', message: `Ignoring notification: ${notification.method}` });
    return;
  }
  const params = (notification.params ?? {}) as NotificationParams;
  const text = params.text ?? '';
  if (!text) {
    log({ level: 'warn', message: 'Matching notification had no text' });
    return;
  }
  if (!checkAccessibility().trusted) {
    log({ level: 'error', message: 'Accessibility not granted; cannot open Claude Desktop' });
    return;
  }
  void driveClaude({ text, autoSend: settings.autoSend, appName: settings.claudeAppName });
}

export async function runTestAction(): Promise<void> {
  const settings = getSettings();
  if (!checkAccessibility().trusted) {
    log({ level: 'error', message: 'Accessibility not granted; cannot open Claude Desktop' });
    return;
  }
  await driveClaude({
    text: TEST_ACTION_TEXT,
    autoSend: settings.autoSend,
    appName: settings.claudeAppName,
  });
}
