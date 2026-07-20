import type { LogEntry } from '#shared/log.ts';
import { requireElement } from '../lib/dom.ts';

const COPY_FEEDBACK_MS = 1200;

const logEntries: LogEntry[] = [];

function formatLogLine(entry: LogEntry): string {
  return `${new Date(entry.time).toLocaleTimeString()} [${entry.level}] ${entry.message}`;
}

async function copyLog(button: HTMLButtonElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(logEntries.map(formatLogLine).join('\n'));
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Failed';
  }
  window.setTimeout(() => {
    button.textContent = 'Copy';
  }, COPY_FEEDBACK_MS);
}

export function wireCopyLog(): void {
  const button = requireElement<HTMLButtonElement>('#copy-log');
  button.addEventListener('click', (event) => {
    // The button lives inside <summary>; keep the click from toggling the accordion.
    event.preventDefault();
    event.stopPropagation();
    void copyLog(button);
  });
}

export function renderLogEntry(entry: LogEntry): void {
  logEntries.push(entry);
  const list = requireElement<HTMLOListElement>('#log');
  const item = document.createElement('li');
  item.className = `log__entry log__entry--${entry.level}`;

  const time = document.createElement('time');
  time.className = 'log__time';
  time.textContent = new Date(entry.time).toLocaleTimeString();

  const message = document.createElement('span');
  message.className = 'log__message';
  message.textContent = entry.message;

  item.append(time, message);
  list.append(item);
  list.scrollTop = list.scrollHeight;
}
