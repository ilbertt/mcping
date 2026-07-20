export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  time: string;
  level: LogLevel;
  message: string;
}
