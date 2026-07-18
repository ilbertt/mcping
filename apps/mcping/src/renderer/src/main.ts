import './styles.css';
import type {
  AccessibilityStatus,
  ConnectionState,
  ConnectionStatus,
  LogEntry,
  Settings,
} from '#shared/types.ts';

const api = window.mcping;

const ACCESSIBILITY_GRANTED = 'Granted';
const ACCESSIBILITY_MISSING = 'Not granted';

const STATUS_LABEL: Record<ConnectionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Error',
};

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
}

function settingInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('[data-setting]'));
}

function fillForm(settings: Settings): void {
  for (const input of settingInputs()) {
    const key = input.dataset.setting as keyof Settings;
    const value = settings[key];
    if (typeof value === 'boolean') {
      input.checked = value;
    } else {
      input.value = value;
    }
  }
}

function patchFromInput(input: HTMLInputElement): Partial<Settings> {
  const key = input.dataset.setting as keyof Settings;
  if (input.type === 'checkbox') {
    return { [key]: input.checked } as Partial<Settings>;
  }
  return { [key]: input.value.trim() } as Partial<Settings>;
}

async function saveInput(input: HTMLInputElement): Promise<void> {
  fillForm(await api.setSettings(patchFromInput(input)));
}

function wireForm(): void {
  for (const input of settingInputs()) {
    input.addEventListener('change', () => {
      void saveInput(input);
    });
  }
}

function renderStatus(status: ConnectionStatus): void {
  const pill = requireElement<HTMLElement>('#status-pill');
  pill.textContent = STATUS_LABEL[status.state];
  pill.classList.toggle('pill--ok', status.state === 'connected');
  pill.classList.toggle('pill--warn', status.state === 'error');
  requireElement<HTMLElement>('#status-detail').textContent = status.detail ?? '';

  const isBusy = status.state === 'connecting';
  const isConnected = status.state === 'connected';
  requireElement<HTMLButtonElement>('#connect').disabled = isConnected || isBusy;
  requireElement<HTMLButtonElement>('#disconnect').disabled = !(isConnected || isBusy);
}

function wireConnection(): void {
  requireElement<HTMLButtonElement>('#connect').addEventListener('click', () => {
    void api.connect();
  });
  requireElement<HTMLButtonElement>('#disconnect').addEventListener('click', () => {
    void api.disconnect();
  });
  requireElement<HTMLButtonElement>('#test-action').addEventListener('click', () => {
    void api.runTestAction();
  });
}

function renderAccessibility(status: AccessibilityStatus): void {
  const pill = requireElement<HTMLElement>('#accessibility-pill');
  pill.textContent = status.trusted ? ACCESSIBILITY_GRANTED : ACCESSIBILITY_MISSING;
  pill.classList.toggle('pill--ok', status.trusted);
  pill.classList.toggle('pill--warn', !status.trusted);
}

async function refreshAccessibility(): Promise<void> {
  renderAccessibility(await api.checkAccessibility());
}

function renderLogEntry(entry: LogEntry): void {
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

function wireAccessibility(): void {
  requireElement<HTMLButtonElement>('#accessibility-open').addEventListener('click', () => {
    void api.openAccessibilitySettings();
  });
  requireElement<HTMLButtonElement>('#accessibility-recheck').addEventListener('click', () => {
    void refreshAccessibility();
  });
}

async function init(): Promise<void> {
  fillForm(await api.getSettings());
  wireForm();

  wireConnection();
  renderStatus(await api.getStatus());
  api.onStatus(renderStatus);

  wireAccessibility();
  await refreshAccessibility();

  for (const entry of await api.getLog()) {
    renderLogEntry(entry);
  }
  api.onLog(renderLogEntry);
}

void init();
