import type { ServerAuthState } from '#shared/auth.ts';
import type { ConnectionState, ConnectionStatus, ServerStatus } from '#shared/connection.ts';
import type { McpServer, ServerDraft } from '#shared/server.ts';
import { api } from '../lib/api.ts';
import { actionButton, requireChild, requireElement } from '../lib/dom.ts';
import { EMPTY_AUTH_STATE, wireAuth } from './server-auth.ts';

const STATUS_LABEL: Record<ConnectionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Error',
};

// Set while a just-added server is still blank; blocks a second add until it
// connects or is removed.
let pendingServerId: string | null = null;

function addButton(): HTMLButtonElement {
  return requireElement<HTMLButtonElement>('#add-server');
}

function syncAddButton(): void {
  addButton().disabled = pendingServerId !== null;
}

function findCard(serverId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.server[data-server-id="${serverId}"]`);
}

function trimmedValue(options: { card: HTMLElement; selector: string }): string {
  return requireChild<HTMLInputElement>({
    root: options.card,
    selector: options.selector,
  }).value.trim();
}

function serverFormComplete(card: HTMLElement): boolean {
  if (
    !trimmedValue({ card, selector: '[data-field="name"]' }) ||
    !trimmedValue({ card, selector: '[data-field="url"]' })
  ) {
    return false;
  }
  const authType = requireChild<HTMLSelectElement>({
    root: card,
    selector: '[data-auth="type"]',
  }).value;
  if (authType === 'header') {
    return (
      Boolean(trimmedValue({ card, selector: '[data-auth="header-name"]' })) &&
      card.dataset.secretSet === 'true'
    );
  }
  return true;
}

function refreshConnectButton(card: HTMLElement): void {
  actionButton({ card, action: 'connect' }).disabled = !serverFormComplete(card);
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
  if (id === pendingServerId) {
    pendingServerId = null;
  }
  await renderServers();
  syncAddButton();
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

function buildServerCard(options: { server: McpServer; authState: ServerAuthState }): HTMLElement {
  const { server, authState } = options;
  const template = requireElement<HTMLTemplateElement>('#server-template');
  const card = requireChild<HTMLElement>({
    root: template.content.cloneNode(true) as DocumentFragment,
    selector: '.server',
  });
  card.dataset.serverId = server.id;
  const title = requireChild<HTMLElement>({ root: card, selector: '[data-role="title"]' });
  title.textContent = server.name.trim() || 'Untitled server';
  const refresh = (): void => {
    refreshConnectButton(card);
  };
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
    input.addEventListener('input', refresh);
    if (input.dataset.field === 'name') {
      input.addEventListener('input', () => {
        title.textContent = input.value.trim() || 'Untitled server';
      });
    }
  }
  wireCardActions({ card, id: server.id });
  wireAuth({ card, server, state: authState, onChange: refresh });
  refresh();
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

  // Exactly one button shows — the one for the opposite of the current state.
  // Connect while not connected (disconnected or error → connect/retry),
  // Disconnect while connected or mid-connect (so a hanging connect can be
  // cancelled).
  const active = status.state === 'connected' || status.state === 'connecting';
  actionButton({ card, action: 'connect' }).hidden = active;
  actionButton({ card, action: 'disconnect' }).hidden = !active;
}

export function applyServerStatus(entry: ServerStatus): void {
  const card = findCard(entry.serverId);
  if (card) {
    updateCardStatus({ card, status: entry.status });
  }
  if (entry.serverId === pendingServerId && entry.status.state === 'connected') {
    pendingServerId = null;
    syncAddButton();
  }
}

function applyStatuses(statuses: ServerStatus[]): void {
  for (const entry of statuses) {
    applyServerStatus(entry);
  }
}

export async function renderServers(): Promise<void> {
  const container = requireElement<HTMLElement>('#servers');
  const [settings, authStates] = await Promise.all([api.getSettings(), api.getAuthStates()]);
  container.replaceChildren(
    ...settings.servers.map((server) =>
      buildServerCard({ server, authState: authStates[server.id] ?? EMPTY_AUTH_STATE }),
    ),
  );
  const pendingCard = pendingServerId ? findCard(pendingServerId) : null;
  if (pendingCard instanceof HTMLDetailsElement) {
    pendingCard.open = true;
  }
  applyStatuses(await api.getStatuses());
}

async function addServer(): Promise<void> {
  const settings = await api.addServer({
    name: '',
    url: '',
    autoConnect: true,
    auth: { type: 'none' },
  });
  pendingServerId = settings.servers.at(-1)?.id ?? null;
  await renderServers();
  syncAddButton();
}

export function wireAddServer(): void {
  addButton().addEventListener('click', () => {
    void addServer();
  });
  syncAddButton();
}
