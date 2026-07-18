import type { MenuItemConstructorOptions } from 'electron';
import { Menu, Tray } from 'electron';
import {
  connectServer,
  disconnectServer,
  getStatuses,
  onStatusChange,
} from '#main/mcp-listener.ts';
import { getSettings } from '#main/settings-store.ts';
import { showSettingsWindow } from '#main/settings-window.ts';
import { createTrayIcon } from '#main/tray-icon.ts';
import type { ConnectionState } from '#shared/types.ts';
import { APP_NAME } from '#shared/types.ts';

let tray: Tray | null = null;

const STATUS_LABEL: Record<ConnectionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Connection error',
};

function statusStates(): Map<string, ConnectionState> {
  return new Map(getStatuses().map((entry) => [entry.serverId, entry.status.state]));
}

function serversSubmenu(states: Map<string, ConnectionState>): MenuItemConstructorOptions[] {
  const { servers } = getSettings();
  if (servers.length === 0) {
    return [{ label: 'No servers — open Settings…', enabled: false }];
  }
  return servers.map((server) => {
    const state = states.get(server.id) ?? 'disconnected';
    const active = state === 'connected' || state === 'connecting';
    return {
      label: `${server.name} — ${STATUS_LABEL[state]}`,
      type: 'checkbox',
      checked: state === 'connected',
      click: () => {
        if (active) {
          void disconnectServer(server.id);
        } else {
          void connectServer(server.id);
        }
      },
    };
  });
}

function buildMenu(): Menu {
  const { servers } = getSettings();
  const states = statusStates();
  const connected = servers.filter((server) => states.get(server.id) === 'connected').length;
  return Menu.buildFromTemplate([
    { label: APP_NAME, enabled: false },
    { label: `${connected} of ${servers.length} connected`, enabled: false },
    { type: 'separator' },
    { label: 'MCP servers', submenu: serversSubmenu(states) },
    { type: 'separator' },
    {
      label: 'Settings…',
      click: () => {
        showSettingsWindow();
      },
    },
    { type: 'separator' },
    { role: 'quit', label: `Quit ${APP_NAME}` },
  ]);
}

export function refreshTray(): void {
  if (!tray) {
    return;
  }
  const { servers } = getSettings();
  const states = statusStates();
  const connected = servers.filter((server) => states.get(server.id) === 'connected').length;
  tray.setContextMenu(buildMenu());
  tray.setToolTip(`${APP_NAME} — ${connected} of ${servers.length} connected`);
}

export function createTray(): void {
  tray = new Tray(createTrayIcon());
  refreshTray();
  onStatusChange(refreshTray);
}
