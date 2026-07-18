import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { clipboard } from 'electron';

const execFileAsync = promisify(execFile);

const APP_ACTIVATE_DELAY_S = 1;
const NEW_CHAT_RENDER_DELAY_S = 1.5;
const BEFORE_SEND_DELAY_S = 0.4;
const RETURN_KEY_CODE = 36;

interface OpenChatOptions {
  text: string;
  appName?: string;
  autoSend?: boolean;
  editMenu?: string;
  pasteItem?: string;
}

function toAppleScriptLiteral(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// Findings from the prototype, kept deliberately:
// - Cmd+N opens a new conversation reliably.
// - Synthetic Cmd+V does NOT paste in Claude's Electron webview, so we click the
//   real Edit > Paste menu item (goes through the responder chain like a manual
//   paste) to preserve emoji and newlines.
// - Claude is Electron and needs generous delays to render before the paste.
export async function openClaudeDesktopWithText(options: OpenChatOptions): Promise<void> {
  const {
    text,
    appName = 'Claude',
    autoSend = false,
    editMenu = 'Edit',
    pasteItem = 'Paste',
  } = options;

  clipboard.writeText(text);

  const app = toAppleScriptLiteral(appName);
  const lines = [
    `tell application ${app}`,
    '  activate',
    `  delay ${APP_ACTIVATE_DELAY_S}`,
    '  tell application "System Events"',
    `    tell process ${app}`,
    '      keystroke "n" using command down',
    `      delay ${NEW_CHAT_RENDER_DELAY_S}`,
    `      click menu item ${toAppleScriptLiteral(pasteItem)} of menu 1 of menu bar item ${toAppleScriptLiteral(editMenu)} of menu bar 1`,
  ];
  if (autoSend) {
    lines.push(`      delay ${BEFORE_SEND_DELAY_S}`, `      key code ${RETURN_KEY_CODE}`);
  }
  lines.push('    end tell', '  end tell', 'end tell');

  await execFileAsync('osascript', ['-e', lines.join('\n')]);
}
