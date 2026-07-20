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

export function findCard(serverId: string): HTMLElement | null {
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

export function updateCardStatus(options: { card: HTMLElement; status: ConnectionStatus }): void {
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

function applyStatuses(statuses: ServerStatus[]): void {
  for (const entry of statuses) {
    const card = findCard(entry.serverId);
    if (card) {
      updateCardStatus({ card, status: entry.status });
    }
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
  applyStatuses(await api.getStatuses());
}

export async function addServer(): Promise<void> {
  await api.addServer({ name: '', url: '', autoConnect: true, auth: { type: 'none' } });
  await renderServers();
}
