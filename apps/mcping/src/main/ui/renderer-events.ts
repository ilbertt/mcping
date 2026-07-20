import { getSettingsWindow } from '#main/ui/settings-window.ts';
import type { ServerStatus } from '#shared/connection.ts';
import { IPC } from '#shared/ipc.ts';
import type { LogEntry } from '#shared/log.ts';

function send(options: { channel: string; payload: unknown }): void {
  const window = getSettingsWindow();
  if (window && !window.isDestroyed()) {
    window.webContents.send(options.channel, options.payload);
  }
}

export function sendStatus(status: ServerStatus): void {
  send({ channel: IPC.mcpStatus, payload: status });
}

export function sendLogEntry(entry: LogEntry): void {
  send({ channel: IPC.logEntry, payload: entry });
}
