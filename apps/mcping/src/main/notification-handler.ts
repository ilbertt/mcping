import { Notification as DesktopNotification } from 'electron';
import type { Notification } from 'mcp-use/client';
import { checkAccessibility } from '#main/accessibility.ts';
import type { ActionInput, SupportedAction } from '#main/actions.ts';
import { findAction, TEST_ACTION_NAME } from '#main/actions.ts';
import { log } from '#main/logger.ts';
import type { McpServer } from '#shared/types.ts';
import { APP_NAME } from '#shared/types.ts';

const TEST_ACTION_TEXT =
  'mcping test action 👋\nIf you can read this, the Claude Desktop driver works.';

// A server names the action it wants (from mcping's controlled catalog) and its
// inputs in the notification params. The notification method itself is up to the
// server and is not matched here.
interface NotificationParams {
  action?: string;
  text?: string;
}

async function runAndLog(options: { action: SupportedAction; input: ActionInput }): Promise<void> {
  try {
    await options.action.run(options.input);
    log({ level: 'info', message: `Ran action: ${options.action.label}` });
  } catch (error) {
    log({ level: 'error', message: `Action failed (${options.action.label}): ${String(error)}` });
  }
}

// Approval prompt for a background menu-bar app: a clickable system
// notification. Clicking it approves and runs the action; ignoring it declines.
function requestApproval(options: { text: string; label: string; onApprove: () => void }): void {
  const notification = new DesktopNotification({
    title: `${APP_NAME}: ${options.label}?`,
    body: options.text,
  });
  notification.on('click', options.onApprove);
  notification.show();
}

function runWithApproval(options: {
  action: SupportedAction;
  input: ActionInput;
  requireApproval: boolean;
}): void {
  const { action, input, requireApproval } = options;
  const drive = (): void => {
    void runAndLog({ action, input });
  };
  if (requireApproval && DesktopNotification.isSupported()) {
    log({
      level: 'info',
      message: `Action pending approval — click the notification to ${action.label}`,
    });
    requestApproval({ text: input.text, label: action.label, onApprove: drive });
    return;
  }
  drive();
}

export function handleNotification(options: {
  notification: Notification;
  server: McpServer;
}): void {
  const { notification, server } = options;
  const params = (notification.params ?? {}) as NotificationParams;
  const action = findAction(params.action ?? '');
  if (!action) {
    log({
      level: 'info',
      message: `[${server.name}] Ignoring notification (unsupported action: ${params.action ?? 'none'})`,
    });
    return;
  }
  const text = params.text ?? '';
  if (!text) {
    log({ level: 'warn', message: `[${server.name}] Action "${params.action}" had no text` });
    return;
  }
  if (!checkAccessibility().trusted) {
    log({ level: 'error', message: `Accessibility not granted; cannot ${action.label}` });
    return;
  }
  runWithApproval({
    action,
    input: { text, autoSend: server.autoSend },
    requireApproval: server.requireApproval,
  });
}

export async function runTestAction(server: McpServer): Promise<void> {
  const action = findAction(TEST_ACTION_NAME);
  if (!action) {
    return;
  }
  if (!checkAccessibility().trusted) {
    log({ level: 'error', message: `Accessibility not granted; cannot ${action.label}` });
    return;
  }
  await runAndLog({ action, input: { text: TEST_ACTION_TEXT, autoSend: server.autoSend } });
}
