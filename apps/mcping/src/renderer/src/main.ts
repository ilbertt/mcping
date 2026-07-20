import './styles.css';
import type {
  ConnectionState,
  ConnectionStatus,
  LogEntry,
  McpServer,
  ServerAuth,
  ServerAuthState,
  ServerAuthType,
  ServerDraft,
  ServerStatus,
  Settings,
} from '#shared/types.ts';
import { DEFAULT_HEADER_NAME, DEFAULT_SERVER } from '#shared/types.ts';

const api = window.mcping;

const EMPTY_AUTH_STATE: ServerAuthState = { secretSet: false, oauthAuthorized: false };

const STATUS_LABEL: Record<ConnectionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Error',
};

type GlobalSettingKey = keyof Omit<Settings, 'servers'>;

const COPY_FEEDBACK_MS = 1200;

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
  actionButton({ card, action: 'remove' }).addEventListener('click', () => {
    void removeServer(id);
  });
}

function authDescriptor(options: { type: ServerAuthType; headerName: string }): ServerAuth {
  switch (options.type) {
    case 'header':
      return { type: 'header', name: options.headerName.trim() || DEFAULT_HEADER_NAME };
    case 'bearer':
      return { type: 'bearer' };
    case 'oauth':
      return { type: 'oauth' };
    case 'none':
      return { type: 'none' };
  }
}

function applyAuthVisibility(options: { card: HTMLElement; type: ServerAuthType }): void {
  const { card, type } = options;
  const setHidden = (config: { name: string; hidden: boolean }): void => {
    requireChild<HTMLElement>({
      root: card,
      selector: `[data-auth-field="${config.name}"]`,
    }).hidden = config.hidden;
  };
  setHidden({ name: 'header-name', hidden: type !== 'header' });
  setHidden({ name: 'secret', hidden: type !== 'bearer' && type !== 'header' });
  setHidden({ name: 'oauth', hidden: type !== 'oauth' });
  requireChild<HTMLElement>({ root: card, selector: '[data-role="secret-label"]' }).textContent =
    type === 'header' ? 'Header value' : 'Token';
}

function applyAuthState(options: { card: HTMLElement; state: ServerAuthState }): void {
  const { card, state } = options;
  requireChild<HTMLElement>({ root: card, selector: '[data-role="secret-state"]' }).textContent =
    state.secretSet ? 'Saved ✓' : 'Not set';
  requireChild<HTMLElement>({ root: card, selector: '[data-role="oauth-state"]' }).textContent =
    state.oauthAuthorized ? 'Signed in ✓' : 'Sign in through your browser when you connect.';
  requireChild<HTMLButtonElement>({ root: card, selector: '[data-action="sign-out"]' }).hidden =
    !state.oauthAuthorized;
}

async function refreshAuthState(options: { card: HTMLElement; id: string }): Promise<void> {
  const states = await api.getAuthStates();
  applyAuthState({ card: options.card, state: states[options.id] ?? EMPTY_AUTH_STATE });
}

async function saveAuth(options: {
  card: HTMLElement;
  id: string;
  type: ServerAuthType;
  headerName: string;
}): Promise<void> {
  await api.updateServer({
    id: options.id,
    patch: { auth: authDescriptor({ type: options.type, headerName: options.headerName }) },
  });
  await refreshAuthState({ card: options.card, id: options.id });
}

async function saveSecret(options: {
  card: HTMLElement;
  id: string;
  input: HTMLInputElement;
}): Promise<void> {
  const secret = options.input.value;
  if (!secret) {
    return;
  }
  await api.setServerSecret({ id: options.id, secret });
  options.input.value = '';
  await refreshAuthState({ card: options.card, id: options.id });
}

async function handleSignOut(options: { card: HTMLElement; id: string }): Promise<void> {
  await api.signOut(options.id);
  await refreshAuthState({ card: options.card, id: options.id });
}

function wireAuth(options: { card: HTMLElement; server: McpServer; state: ServerAuthState }): void {
  const { card, server } = options;
  const select = requireChild<HTMLSelectElement>({ root: card, selector: '[data-auth="type"]' });
  const headerName = requireChild<HTMLInputElement>({
    root: card,
    selector: '[data-auth="header-name"]',
  });
  const secret = requireChild<HTMLInputElement>({ root: card, selector: '[data-auth="secret"]' });

  select.value = server.auth.type;
  headerName.value = server.auth.type === 'header' ? server.auth.name : DEFAULT_HEADER_NAME;
  applyAuthVisibility({ card, type: server.auth.type });
  applyAuthState({ card, state: options.state });

  select.addEventListener('change', () => {
    const type = select.value as ServerAuthType;
    applyAuthVisibility({ card, type });
    void saveAuth({ card, id: server.id, type, headerName: headerName.value });
  });
  headerName.addEventListener('change', () => {
    if (select.value === 'header') {
      void saveAuth({ card, id: server.id, type: 'header', headerName: headerName.value });
    }
  });
  actionButton({ card, action: 'save-secret' }).addEventListener('click', () => {
    void saveSecret({ card, id: server.id, input: secret });
  });
  actionButton({ card, action: 'sign-out' }).addEventListener('click', () => {
    void handleSignOut({ card, id: server.id });
  });
}

function buildServerCard(options: { server: McpServer; authState: ServerAuthState }): HTMLElement {
  const { server, authState } = options;
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
    } else if (typeof value === 'string') {
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
  wireAuth({ card, server, state: authState });
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

  // Connect is pointless while connected or mid-connect; Disconnect is pointless
  // while fully disconnected. The error state keeps both: retry now, or give up.
  actionButton({ card, action: 'connect' }).hidden =
    status.state === 'connected' || status.state === 'connecting';
  actionButton({ card, action: 'disconnect' }).hidden = status.state === 'disconnected';
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
  const [settings, authStates] = await Promise.all([api.getSettings(), api.getAuthStates()]);
  container.replaceChildren(
    ...settings.servers.map((server) =>
      buildServerCard({ server, authState: authStates[server.id] ?? EMPTY_AUTH_STATE }),
    ),
  );
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

function wireCopyLog(): void {
  const button = requireElement<HTMLButtonElement>('#copy-log');
  button.addEventListener('click', (event) => {
    // The button lives inside <summary>; keep the click from toggling the accordion.
    event.preventDefault();
    event.stopPropagation();
    void copyLog(button);
  });
}

function renderLogEntry(entry: LogEntry): void {
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

  wireCopyLog();
  for (const entry of await api.getLog()) {
    renderLogEntry(entry);
  }
  api.onLog(renderLogEntry);
}

void init();
