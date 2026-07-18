import { getSettingsWindow } from '#main/settings-window.ts';
import type { ConnectionStatus, LogEntry } from '#shared/types.ts';
import { IPC } from '#shared/types.ts';

function send(options: { channel: string; payload: unknown }): void {
  const window = getSettingsWindow();
  if (window && !window.isDestroyed()) {
    window.webContents.send(options.channel, options.payload);
  }
}

export function sendStatus(status: ConnectionStatus): void {
  send({ channel: IPC.mcpStatus, payload: status });
}

export function sendLogEntry(entry: LogEntry): void {
  send({ channel: IPC.logEntry, payload: entry });
}
