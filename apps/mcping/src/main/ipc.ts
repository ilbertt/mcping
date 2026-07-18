import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import { checkAccessibility, openAccessibilitySettings } from '#main/accessibility.ts';
import { getLog } from '#main/logger.ts';
import { connect, disconnect, getStatus } from '#main/mcp-listener.ts';
import { getSettings, updateSettings } from '#main/settings-store.ts';
import type { Settings } from '#shared/types.ts';
import { IPC } from '#shared/types.ts';

function handle<Req, Res>(options: {
  channel: string;
  handler: (payload: Req) => Res | Promise<Res>;
}): void {
  ipcMain.handle(options.channel, (...args: [IpcMainInvokeEvent, Req]) => options.handler(args[1]));
}

export function registerIpc(): void {
  handle({ channel: IPC.settingsGet, handler: () => getSettings() });
  handle<Partial<Settings>, Settings>({
    channel: IPC.settingsSet,
    handler: (patch) => updateSettings(patch),
  });
  handle({ channel: IPC.mcpConnect, handler: () => connect() });
  handle({ channel: IPC.mcpDisconnect, handler: () => disconnect() });
  handle({ channel: IPC.mcpGetStatus, handler: () => getStatus() });
  handle({ channel: IPC.accessibilityCheck, handler: () => checkAccessibility() });
  handle({ channel: IPC.accessibilityOpenSettings, handler: () => openAccessibilitySettings() });
  handle({ channel: IPC.logGet, handler: () => getLog() });
}
