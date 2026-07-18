import { MCPClient } from 'mcp-use/client';
import { log } from '#main/logger.ts';
import { handleNotification } from '#main/notification-handler.ts';
import { sendStatus } from '#main/renderer-events.ts';
import { getSettings } from '#main/settings-store.ts';
import type { ConnectionStatus, McpServer, ServerStatus } from '#shared/types.ts';

const SESSION_KEY = 'server';
const MS_PER_SECOND = 1000;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_FACTOR = 2;
const HEALTH_CHECK_INTERVAL_MS = 5000;

class ServerConnection {
  private server: McpServer;
  private readonly onStatus: (status: ConnectionStatus) => void;
  private client: MCPClient | null = null;
  private status: ConnectionStatus = { state: 'disconnected' };
  private desiredConnected = false;
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthTimer: NodeJS.Timeout | null = null;

  constructor(options: { server: McpServer; onStatus: (status: ConnectionStatus) => void }) {
    this.server = options.server;
    this.onStatus = options.onStatus;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  updateConfig(server: McpServer): void {
    const urlChanged = this.server.url !== server.url;
    this.server = server;
    if (urlChanged && this.desiredConnected) {
      void this.connect();
    }
  }

  private setStatus(next: ConnectionStatus): void {
    this.status = next;
    this.onStatus(next);
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
    if (this.client) {
      const closing = this.client;
      this.client = null;
      try {
        await closing.closeAllSessions();
      } catch (error) {
        log({
          level: 'warn',
          message: `[${this.server.name}] Error closing sessions: ${String(error)}`,
        });
      }
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
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
    this.healthTimer = setInterval(() => {
      if (!this.client || !this.desiredConnected || this.status.state !== 'connected') {
        return;
      }
      const connected = this.client.getSession(SESSION_KEY)?.connector.isClientConnected ?? false;
      if (!connected) {
        log({ level: 'warn', message: `[${this.server.name}] Connection lost` });
        this.setStatus({ state: 'error', detail: 'Connection lost' });
        void this.reconnectAfterDrop();
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private async reconnectAfterDrop(): Promise<void> {
    await this.disposeClient();
    if (this.desiredConnected) {
      this.scheduleReconnect();
    }
  }

  private async attemptConnect(): Promise<void> {
    if (!this.desiredConnected) {
      return;
    }
    const { url, name } = this.server;
    this.setStatus({ state: 'connecting', detail: url });
    log({ level: 'info', message: `[${name}] Connecting to ${url}` });
    try {
      const next = new MCPClient(
        { mcpServers: { [SESSION_KEY]: { url } } },
        {
          onNotification: (notification) =>
            handleNotification({ notification, server: this.server }),
        },
      );
      await next.createSession(SESSION_KEY);
      this.client = next;
      this.backoffMs = INITIAL_BACKOFF_MS;
      this.setStatus({ state: 'connected', detail: url });
      log({ level: 'info', message: `[${name}] Connected` });
      this.startHealthCheck();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log({ level: 'error', message: `[${name}] Connection failed: ${detail}` });
      this.setStatus({ state: 'error', detail });
      await this.disposeClient();
      if (this.desiredConnected) {
        this.scheduleReconnect();
      }
    }
  }

  async connect(): Promise<void> {
    this.desiredConnected = true;
    this.clearReconnectTimer();
    this.backoffMs = INITIAL_BACKOFF_MS;
    await this.disposeClient();
    await this.attemptConnect();
  }

  async disconnect(): Promise<void> {
    this.desiredConnected = false;
    this.clearReconnectTimer();
    await this.disposeClient();
    this.setStatus({ state: 'disconnected' });
    log({ level: 'info', message: `[${this.server.name}] Disconnected` });
  }

  async dispose(): Promise<void> {
    this.desiredConnected = false;
    this.clearReconnectTimer();
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

// Reconcile the connection registry against the persisted server list: create
// connections for new servers, dispose those whose server was removed, and push
// config changes into the rest.
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
