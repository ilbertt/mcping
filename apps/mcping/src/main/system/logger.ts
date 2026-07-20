import { sendLogEntry } from '#main/ui/renderer-events.ts';
import { APP_NAME } from '#shared/app.ts';
import type { LogEntry, LogLevel } from '#shared/log.ts';

const MAX_LOG_ENTRIES = 200;

const entries: LogEntry[] = [];

function consoleFor(level: LogLevel): (message: string) => void {
  if (level === 'error') {
    return console.error;
  }
  if (level === 'warn') {
    return console.warn;
  }
  return console.log;
}

export function log(options: { level: LogLevel; message: string }): void {
  const entry: LogEntry = {
    time: new Date().toISOString(),
    level: options.level,
    message: options.message,
  };
  entries.push(entry);
  if (entries.length > MAX_LOG_ENTRIES) {
    entries.shift();
  }
  consoleFor(options.level)(`[${APP_NAME}] ${options.message}`);
  sendLogEntry(entry);
}

export function getLog(): LogEntry[] {
  return [...entries];
}
