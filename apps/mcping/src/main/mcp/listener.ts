import {
  Client,
  type McpSubscription,
  type Notification,
  SdkHttpError,
  StreamableHTTPClientTransport,
  type SubscriptionFilter,
  UnauthorizedError,
} from '@modelcontextprotocol/client';
import { MCPING_EXTENSION_ID, MCPING_SUBSCRIPTION_FILTER } from '@repo/mcping-protocol';
import { app } from 'electron';
import { McpingOAuthProvider } from '#main/auth/oauth.ts';
import { handleNotification } from '#main/mcp/notification-handler.ts';
import { secretStore } from '#main/stores/secret-store.ts';
import { getSettings } from '#main/stores/settings-store.ts';
import { log } from '#main/system/logger.ts';
import { sendStatus } from '#main/ui/renderer-events.ts';
import type { ServerAuth } from '#shared/auth.ts';
import type { ConnectionStatus, ServerStatus } from '#shared/connection.ts';
import type { McpServer } from '#shared/server.ts';

const CLIENT_NAME = 'mcping';
const MS_PER_SECOND = 1000;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_FACTOR = 2;
const HEALTH_CHECK_INTERVAL_MS = 5000;
const HEALTH_CHECK_TIMEOUT_MS = 4000;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;

const AUTH_REQUIRED_DETAIL = 'Authorization required — click Connect';
const AWAITING_AUTH_DETAIL = 'Waiting for browser authorization…';

// The mcping extension merges `{ push: true }` into the subscriptions/listen
// filter; the core filter type has no such field, so widen it at the boundary.
const MCPING_LISTEN_FILTER = MCPING_SUBSCRIPTION_FILTER as unknown as SubscriptionFilter;

interface LiveClient {
  client: Client;
  transport: StreamableHTTPClientTransport;
  subscription: McpSubscription;
}

function newClient(): Client {
  return new Client(
    { name: CLIENT_NAME, version: app.getVersion() },
    {
      // Declare the mcping extension in per-request client capabilities so a
      // server knows this client wants its pushes.
      capabilities: { extensions: { [MCPING_EXTENSION_ID]: {} } },
      // Negotiate the modern (2026-07-28) era via server/discover, falling back
      // to the 2025 initialize handshake for legacy servers.
      versionNegotiation: { mode: 'auto' },
    },
  );
}

function buildTransport(options: {
  server: McpServer;
  oauthProvider: McpingOAuthProvider | null;
}): StreamableHTTPClientTransport {
  const { server, oauthProvider } = options;
  const url = new URL(server.url);
  switch (server.auth.type) {
    case 'header': {
      const value = secretStore.get(server.id);
      return new StreamableHTTPClientTransport(
        url,
        value ? { requestInit: { headers: { [server.auth.name]: value } } } : undefined,
      );
    }
    case 'oauth':
      return new StreamableHTTPClientTransport(
        url,
        oauthProvider ? { authProvider: oauthProvider } : undefined,
      );
    default:
      return new StreamableHTTPClientTransport(url);
  }
}

function authEquals(options: { a: ServerAuth; b: ServerAuth }): boolean {
  const { a, b } = options;
  if (a.type !== b.type) {
    return false;
  }
  if (a.type === 'header' && b.type === 'header') {
    return a.name === b.name;
  }
  return true;
}

// v2 surfaces auth failures as UnauthorizedError and other HTTP failures as
// SdkHttpError, whose `.status` (not `.code`, which is an SdkErrorCode) carries
// the HTTP status. The message check is a defensive fallback.
function isAuthError(error: unknown): boolean {
  if (error instanceof UnauthorizedError) {
    return true;
  }
  if (error instanceof SdkHttpError && error.status === HTTP_UNAUTHORIZED) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return /unauthorized|authentication required|\b401\b/i.test(error.message);
}

// Auth failures and 404s are terminal: retrying can't fix a missing endpoint or
// rejected credentials, so we surface the error and stop the reconnect loop.
function isTerminalConnectError(error: unknown): boolean {
  if (isAuthError(error)) {
    return true;
  }
  if (error instanceof SdkHttpError && error.status === HTTP_NOT_FOUND) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return /\bnot found\b|\b404\b/i.test(error.message);
}

class ServerConnection {
  private server: McpServer;
  private readonly onStatus: (status: ConnectionStatus) => void;
  private live: LiveClient | null = null;
  private status: ConnectionStatus = { state: 'disconnected' };
  private desiredConnected = false;
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthTimer: NodeJS.Timeout | null = null;
  private healthCheckInFlight = false;
  private oauthProvider: McpingOAuthProvider | null = null;
  private oauthProviderUrl: string | null = null;
  // Only a user-initiated connect may open the browser; silent reconnects must
  // not hijack it, so they surface "authorization required" instead.
  private interactiveAuth = false;

  constructor(options: { server: McpServer; onStatus: (status: ConnectionStatus) => void }) {
    this.server = options.server;
    this.onStatus = options.onStatus;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  isActive(): boolean {
    return this.desiredConnected;
  }

  updateConfig(server: McpServer): void {
    const changed =
      this.server.url !== server.url || !authEquals({ a: this.server.auth, b: server.auth });
    this.server = server;
    if (changed && this.desiredConnected) {
      void this.connect();
    }
  }

  private setStatus(next: ConnectionStatus): void {
    this.status = next;
    this.onStatus(next);
  }

  private handleServerNotification(notification: Notification): Promise<void> {
    handleNotification({ notification, server: this.server });
    return Promise.resolve();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private stopHealthCheck(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private async disposeClient(): Promise<void> {
    this.stopHealthCheck();
    const live = this.live;
    this.live = null;
    if (!live) {
      return;
    }
    try {
      await live.subscription.close();
      await live.client.close();
    } catch (error) {
      log({
        level: 'warn',
        message: `[${this.server.name}] Error closing connection: ${String(error)}`,
      });
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    // Reconnects are automatic, so they may reuse or refresh existing tokens but
    // must never pop the browser unprompted.
    this.interactiveAuth = false;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * BACKOFF_FACTOR, MAX_BACKOFF_MS);
    log({
      level: 'info',
      message: `[${this.server.name}] Reconnecting in ${Math.round(delay / MS_PER_SECOND)}s`,
    });
    this.reconnectTimer = setTimeout(() => {
      void this.attemptConnect();
    }, delay);
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthCheckInFlight = false;
    this.healthTimer = setInterval(() => {
      void this.runHealthCheck();
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private async runHealthCheck(): Promise<void> {
    if (this.healthCheckInFlight || !this.desiredConnected || this.status.state !== 'connected') {
      return;
    }
    const live = this.live;
    if (!live) {
      return;
    }
    this.healthCheckInFlight = true;
    try {
      await live.client.ping({ timeout: HEALTH_CHECK_TIMEOUT_MS });
    } catch (error) {
      if (!this.desiredConnected || this.status.state !== 'connected') {
        return;
      }
      const detail = error instanceof Error ? error.message : String(error);
      log({ level: 'warn', message: `[${this.server.name}] Connection lost: ${detail}` });
      if (isTerminalConnectError(error)) {
        this.setStatus({ state: 'error', detail });
        await this.disposeClient();
        return;
      }
      this.setStatus({ state: 'error', detail: 'Connection lost' });
      void this.reconnectAfterDrop();
    } finally {
      this.healthCheckInFlight = false;
    }
  }

  private async reconnectAfterDrop(): Promise<void> {
    await this.disposeClient();
    if (this.desiredConnected) {
      this.scheduleReconnect();
    }
  }

  private disposeOauthProvider(): void {
    this.oauthProvider?.dispose();
    this.oauthProvider = null;
    this.oauthProviderUrl = null;
  }

  private async getOauthProvider(): Promise<McpingOAuthProvider> {
    if (this.oauthProvider && this.oauthProviderUrl === this.server.url) {
      return this.oauthProvider;
    }
    this.disposeOauthProvider();
    this.oauthProvider = await McpingOAuthProvider.create({
      serverId: this.server.id,
      openBrowser: (url) => this.openAuthUrl(url),
    });
    this.oauthProviderUrl = this.server.url;
    return this.oauthProvider;
  }

  private async openAuthUrl(url: string): Promise<void> {
    if (!this.interactiveAuth) {
      return;
    }
    const { shell } = await import('electron');
    await shell.openExternal(url);
  }

  // Open a fresh connection: connect the transport, then open the mcping
  // subscription so the server can push `notifications/mcping/push` on it.
  private async open(oauthProvider: McpingOAuthProvider | null): Promise<LiveClient> {
    const client = newClient();
    client.fallbackNotificationHandler = (notification) =>
      this.handleServerNotification(notification);
    const transport = buildTransport({ server: this.server, oauthProvider });
    await client.connect(transport);
    const subscription = await client.listen(MCPING_LISTEN_FILTER);
    void subscription.closed.then((reason) => {
      if (reason === 'remote' && this.live?.subscription === subscription) {
        void this.reconnectAfterDrop();
      }
    });
    return { client, transport, subscription };
  }

  private onConnected(live: LiveClient): void {
    this.live = live;
    this.backoffMs = INITIAL_BACKOFF_MS;
    this.setStatus({ state: 'connected', detail: this.server.url });
    log({ level: 'info', message: `[${this.server.name}] Connected` });
    this.startHealthCheck();
  }

  private async onConnectError(error: unknown): Promise<void> {
    const detail = error instanceof Error ? error.message : String(error);
    log({ level: 'error', message: `[${this.server.name}] Connection failed: ${detail}` });
    this.setStatus({ state: 'error', detail });
    await this.disposeClient();
    if (this.desiredConnected && !isTerminalConnectError(error)) {
      this.scheduleReconnect();
    }
  }

  // The transport opened the browser and bound the loopback before the 401
  // surfaced. If interactive, capture the redirect, finish the token exchange,
  // and reconnect; otherwise ask the user to reconnect.
  private async handleAuthError(provider: McpingOAuthProvider): Promise<void> {
    if (!this.interactiveAuth) {
      this.disposeOauthProvider();
      log({ level: 'warn', message: `[${this.server.name}] Authorization required` });
      this.setStatus({ state: 'error', detail: AUTH_REQUIRED_DETAIL });
      await this.disposeClient();
      return;
    }
    this.setStatus({ state: 'connecting', detail: AWAITING_AUTH_DETAIL });
    try {
      const params = await provider.awaitCallback();
      const transport = buildTransport({ server: this.server, oauthProvider: provider });
      await transport.finishAuth(params);
      this.onConnected(await this.open(provider));
    } catch (error) {
      await this.onConnectError(error);
    }
  }

  private async attemptConnect(): Promise<void> {
    if (!this.desiredConnected) {
      return;
    }
    const { url, name } = this.server;
    this.setStatus({ state: 'connecting', detail: url });
    log({ level: 'info', message: `[${name}] Connecting to ${url}` });
    let provider: McpingOAuthProvider | null = null;
    try {
      if (this.server.auth.type === 'oauth') {
        provider = await this.getOauthProvider();
      }
      this.onConnected(await this.open(provider));
    } catch (error) {
      if (provider && isAuthError(error)) {
        await this.handleAuthError(provider);
        return;
      }
      await this.onConnectError(error);
    }
  }

  async connect(): Promise<void> {
    this.desiredConnected = true;
    this.interactiveAuth = true;
    this.clearReconnectTimer();
    this.backoffMs = INITIAL_BACKOFF_MS;
    await this.disposeClient();
    await this.attemptConnect();
  }

  async disconnect(): Promise<void> {
    this.desiredConnected = false;
    this.clearReconnectTimer();
    this.disposeOauthProvider();
    await this.disposeClient();
    this.setStatus({ state: 'disconnected' });
    log({ level: 'info', message: `[${this.server.name}] Disconnected` });
  }

  async dispose(): Promise<void> {
    this.desiredConnected = false;
    this.clearReconnectTimer();
    this.disposeOauthProvider();
    await this.disposeClient();
  }
}

type StatusListener = (status: ServerStatus) => void;

const connections = new Map<string, ServerConnection>();
const statusListeners = new Set<StatusListener>();

function emit(serverStatus: ServerStatus): void {
  sendStatus(serverStatus);
  for (const listener of statusListeners) {
    listener(serverStatus);
  }
}

export function onStatusChange(listener: StatusListener): void {
  statusListeners.add(listener);
}

export function getStatuses(): ServerStatus[] {
  return getSettings().servers.map((server) => ({
    serverId: server.id,
    status: connections.get(server.id)?.getStatus() ?? { state: 'disconnected' },
  }));
}

// Reconcile the connection registry against the persisted server list.
export function syncServers(): void {
  const { servers } = getSettings();
  const desiredIds = new Set(servers.map((server) => server.id));
  for (const [id, connection] of connections) {
    if (!desiredIds.has(id)) {
      void connection.dispose();
      connections.delete(id);
    }
  }
  for (const server of servers) {
    const existing = connections.get(server.id);
    if (existing) {
      existing.updateConfig(server);
    } else {
      connections.set(
        server.id,
        new ServerConnection({
          server,
          onStatus: (status) => emit({ serverId: server.id, status }),
        }),
      );
    }
  }
}

export async function connectServer(serverId: string): Promise<void> {
  if (!connections.has(serverId)) {
    syncServers();
  }
  await connections.get(serverId)?.connect();
}

export async function disconnectServer(serverId: string): Promise<void> {
  await connections.get(serverId)?.disconnect();
}

// A credential changed under a live connection: reconnect so it takes effect.
export function reconnectIfActive(serverId: string): void {
  const connection = connections.get(serverId);
  if (connection?.isActive()) {
    void connection.connect();
  }
}

export function connectAutoConnectServers(): void {
  syncServers();
  for (const server of getSettings().servers) {
    if (server.autoConnect) {
      void connections.get(server.id)?.connect();
    }
  }
}

export async function shutdownAll(): Promise<void> {
  await Promise.all([...connections.values()].map((connection) => connection.dispose()));
  connections.clear();
}
