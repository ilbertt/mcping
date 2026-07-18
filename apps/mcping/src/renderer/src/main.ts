import './styles.css';
import type {
  AccessibilityStatus,
  ConnectionState,
  ConnectionStatus,
  LogEntry,
  McpServer,
  ServerDraft,
  ServerStatus,
  Settings,
} from '#shared/types.ts';
import { DEFAULT_SERVER } from '#shared/types.ts';

const api = window.mcping;

const ACCESSIBILITY_GRANTED = 'Granted';
const ACCESSIBILITY_MISSING = 'Not granted';

const STATUS_LABEL: Record<ConnectionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Error',
};

type GlobalSettingKey = keyof Omit<Settings, 'servers'>;

function requireChild<T extends Element>(options: { root: ParentNode; selector: string }): T {
  const element = options.root.querySelector<T>(options.selector);
  if (!element) {
    throw new Error(`Missing element: ${options.selector}`);
  }
  return element;
}

function requireElement<T extends Element>(selector: string): T {
  return requireChild<T>({ root: document, selector });
}

function actionButton(options: { card: HTMLElement; action: string }): HTMLButtonElement {
  return requireChild<HTMLButtonElement>({
    root: options.card,
    selector: `[data-action="${options.action}"]`,
  });
}

function findCard(serverId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.server[data-server-id="${serverId}"]`);
}

async function saveField(options: { id: string; input: HTMLInputElement }): Promise<void> {
  const key = options.input.dataset.field as keyof ServerDraft;
  const patch = (
    options.input.type === 'checkbox'
      ? { [key]: options.input.checked }
      : { [key]: options.input.value.trim() }
  ) as Partial<ServerDraft>;
  await api.updateServer({ id: options.id, patch });
}

async function removeServer(id: string): Promise<void> {
  await api.removeServer(id);
  await renderServers();
}

function wireCardActions(options: { card: HTMLElement; id: string }): void {
  const { card, id } = options;
  actionButton({ card, action: 'connect' }).addEventListener('click', () => {
    void api.connect(id);
  });
  actionButton({ card, action: 'disconnect' }).addEventListener('click', () => {
    void api.disconnect(id);
  });
  actionButton({ card, action: 'test' }).addEventListener('click', () => {
    void api.runTestAction(id);
  });
  actionButton({ card, action: 'remove' }).addEventListener('click', () => {
    void removeServer(id);
  });
}

function buildServerCard(server: McpServer): HTMLElement {
  const template = requireElement<HTMLTemplateElement>('#server-template');
  const card = requireChild<HTMLElement>({
    root: template.content.cloneNode(true) as DocumentFragment,
    selector: '.server',
  });
  card.dataset.serverId = server.id;
  const title = requireChild<HTMLElement>({ root: card, selector: '[data-role="title"]' });
  title.textContent = server.name;
  for (const input of card.querySelectorAll<HTMLInputElement>('[data-field]')) {
    const value = server[input.dataset.field as keyof ServerDraft];
    if (typeof value === 'boolean') {
      input.checked = value;
    } else {
      input.value = value;
    }
    input.addEventListener('change', () => {
      void saveField({ id: server.id, input });
    });
    if (input.dataset.field === 'name') {
      input.addEventListener('input', () => {
        title.textContent = input.value.trim() || 'Untitled server';
      });
    }
  }
  wireCardActions({ card, id: server.id });
  return card;
}

function updateCardStatus(options: { card: HTMLElement; status: ConnectionStatus }): void {
  const { card, status } = options;
  const pill = requireChild<HTMLElement>({ root: card, selector: '[data-role="status"]' });
  pill.textContent = STATUS_LABEL[status.state];
  pill.classList.toggle('pill--ok', status.state === 'connected');
  pill.classList.toggle('pill--warn', status.state === 'error');
  requireChild<HTMLElement>({ root: card, selector: '[data-role="detail"]' }).textContent =
    status.detail ?? '';

  const isBusy = status.state === 'connecting';
  const isConnected = status.state === 'connected';
  actionButton({ card, action: 'connect' }).disabled = isConnected || isBusy;
  actionButton({ card, action: 'disconnect' }).disabled = !(isConnected || isBusy);
}

function applyStatuses(statuses: ServerStatus[]): void {
  for (const entry of statuses) {
    const card = findCard(entry.serverId);
    if (card) {
      updateCardStatus({ card, status: entry.status });
    }
  }
}

async function renderServers(): Promise<void> {
  const container = requireElement<HTMLElement>('#servers');
  const settings = await api.getSettings();
  container.replaceChildren(...settings.servers.map(buildServerCard));
  applyStatuses(await api.getStatuses());
}

async function addServer(): Promise<void> {
  await api.addServer({ ...DEFAULT_SERVER, name: 'New server' });
  await renderServers();
}

function globalInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('[data-setting]'));
}

function fillGlobalSettings(settings: Settings): void {
  for (const input of globalInputs()) {
    input.checked = settings[input.dataset.setting as GlobalSettingKey];
  }
}

function wireGlobalSettings(): void {
  for (const input of globalInputs()) {
    input.addEventListener('change', () => {
      const key = input.dataset.setting as GlobalSettingKey;
      void api.setSettings({ [key]: input.checked } as Partial<Omit<Settings, 'servers'>>);
    });
  }
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

function wireAccessibility(): void {
  requireElement<HTMLButtonElement>('#accessibility-open').addEventListener('click', () => {
    void api.openAccessibilitySettings();
  });
  requireElement<HTMLButtonElement>('#accessibility-recheck').addEventListener('click', () => {
    void refreshAccessibility();
  });
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

async function init(): Promise<void> {
  fillGlobalSettings(await api.getSettings());
  wireGlobalSettings();

  await renderServers();
  requireElement<HTMLButtonElement>('#add-server').addEventListener('click', () => {
    void addServer();
  });
  api.onStatus((entry) => {
    const card = findCard(entry.serverId);
    if (card) {
      updateCardStatus({ card, status: entry.status });
    }
  });

  wireAccessibility();
  await refreshAccessibility();

  for (const entry of await api.getLog()) {
    renderLogEntry(entry);
  }
  api.onLog(renderLogEntry);
}

void init();
