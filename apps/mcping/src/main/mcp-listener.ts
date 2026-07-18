import { MCPClient } from 'mcp-use/client';
import { log } from '#main/logger.ts';
import { handleNotification } from '#main/notification-handler.ts';
import { sendStatus } from '#main/renderer-events.ts';
import { getSettings } from '#main/settings-store.ts';
import type { ConnectionStatus } from '#shared/types.ts';

const SERVER_KEY = 'mcping';
const MS_PER_SECOND = 1000;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_FACTOR = 2;
const HEALTH_CHECK_INTERVAL_MS = 5000;

type StatusListener = (status: ConnectionStatus) => void;

const statusListeners = new Set<StatusListener>();

let client: MCPClient | null = null;
let status: ConnectionStatus = { state: 'disconnected' };
let desiredConnected = false;
let backoffMs = INITIAL_BACKOFF_MS;
let reconnectTimer: NodeJS.Timeout | null = null;
let healthTimer: NodeJS.Timeout | null = null;

export function getStatus(): ConnectionStatus {
  return status;
}

export function onStatusChange(listener: StatusListener): void {
  statusListeners.add(listener);
}

function setStatus(next: ConnectionStatus): void {
  status = next;
  sendStatus(next);
  for (const listener of statusListeners) {
    listener(next);
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function stopHealthCheck(): void {
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
}

async function disposeClient(): Promise<void> {
  stopHealthCheck();
  if (client) {
    const closing = client;
    client = null;
    try {
      await closing.closeAllSessions();
    } catch (error) {
      log({ level: 'warn', message: `Error closing sessions: ${String(error)}` });
    }
  }
}

function scheduleReconnect(): void {
  clearReconnectTimer();
  const delay = backoffMs;
  backoffMs = Math.min(backoffMs * BACKOFF_FACTOR, MAX_BACKOFF_MS);
  log({ level: 'info', message: `Reconnecting in ${Math.round(delay / MS_PER_SECOND)}s` });
  reconnectTimer = setTimeout(() => {
    void attemptConnect();
  }, delay);
}

function startHealthCheck(): void {
  stopHealthCheck();
  healthTimer = setInterval(() => {
    if (!client || !desiredConnected || status.state !== 'connected') {
      return;
    }
    const connected = client.getSession(SERVER_KEY)?.connector.isClientConnected ?? false;
    if (!connected) {
      log({ level: 'warn', message: 'Connection lost' });
      setStatus({ state: 'error', detail: 'Connection lost' });
      void reconnectAfterDrop();
    }
  }, HEALTH_CHECK_INTERVAL_MS);
}

async function reconnectAfterDrop(): Promise<void> {
  await disposeClient();
  if (desiredConnected) {
    scheduleReconnect();
  }
}

async function attemptConnect(): Promise<void> {
  if (!desiredConnected) {
    return;
  }
  const { serverUrl } = getSettings();
  setStatus({ state: 'connecting', detail: serverUrl });
  log({ level: 'info', message: `Connecting to ${serverUrl}` });
  try {
    const next = new MCPClient(
      { mcpServers: { [SERVER_KEY]: { url: serverUrl } } },
      { onNotification: handleNotification },
    );
    await next.createSession(SERVER_KEY);
    client = next;
    backoffMs = INITIAL_BACKOFF_MS;
    setStatus({ state: 'connected', detail: serverUrl });
    log({ level: 'info', message: 'Connected' });
    startHealthCheck();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    log({ level: 'error', message: `Connection failed: ${detail}` });
    setStatus({ state: 'error', detail });
    await disposeClient();
    if (desiredConnected) {
      scheduleReconnect();
    }
  }
}

export async function connect(): Promise<void> {
  desiredConnected = true;
  clearReconnectTimer();
  backoffMs = INITIAL_BACKOFF_MS;
  await disposeClient();
  await attemptConnect();
}

export async function disconnect(): Promise<void> {
  desiredConnected = false;
  clearReconnectTimer();
  await disposeClient();
  setStatus({ state: 'disconnected' });
  log({ level: 'info', message: 'Disconnected' });
}

export async function shutdown(): Promise<void> {
  desiredConnected = false;
  clearReconnectTimer();
  await disposeClient();
}
