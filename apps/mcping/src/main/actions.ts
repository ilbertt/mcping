import { openClaudeDesktopWithText } from '#main/claude-desktop.ts';

// The desktop app mcping is allowed to drive. Fixed on purpose — see below.
const CLAUDE_APP_NAME = 'Claude';

export interface ActionInput {
  text: string;
  autoSend: boolean;
}

export interface SupportedAction {
  label: string;
  run: (input: ActionInput) => Promise<void>;
}

// mcping's controlled catalog of actions a connected server may trigger, keyed by
// action name. A server picks an action from this list (in the notification's
// `action` param) — it can never name an arbitrary app or shell command, so it
// cannot use mcping to execute code on the user's machine. Grow this list
// deliberately; every entry is a capability granted to every connected server.
const CATALOG: Record<string, SupportedAction> = {
  prompt: {
    label: 'open Claude Desktop with a prompt',
    run: (input) =>
      openClaudeDesktopWithText({
        text: input.text,
        autoSend: input.autoSend,
        appName: CLAUDE_APP_NAME,
      }),
  },
};

// The action the tray/settings "Run test action" button exercises.
export const TEST_ACTION_NAME = 'prompt';

export function findAction(name: string): SupportedAction | undefined {
  return CATALOG[name];
}
