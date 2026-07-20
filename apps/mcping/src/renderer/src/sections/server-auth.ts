import type { ServerAuth, ServerAuthState, ServerAuthType } from '#shared/auth.ts';
import { DEFAULT_HEADER_NAME } from '#shared/auth.ts';
import type { McpServer } from '#shared/server.ts';
import { api } from '../lib/api.ts';
import { actionButton, requireChild } from '../lib/dom.ts';

export const EMPTY_AUTH_STATE: ServerAuthState = { secretSet: false, oauthAuthorized: false };

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

export function wireAuth(options: {
  card: HTMLElement;
  server: McpServer;
  state: ServerAuthState;
}): void {
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
