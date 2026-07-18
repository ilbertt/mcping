import { Menu, Tray } from 'electron';
import { connect, disconnect, getStatus, onStatusChange } from '#main/mcp-listener.ts';
import { showSettingsWindow } from '#main/settings-window.ts';
import { createTrayIcon } from '#main/tray-icon.ts';
import type { ConnectionState, ConnectionStatus } from '#shared/types.ts';
import { APP_NAME } from '#shared/types.ts';

let tray: Tray | null = null;

const STATUS_LABEL: Record<ConnectionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Connection error',
};

function buildMenu(status: ConnectionStatus): Menu {
  const isConnected = status.state === 'connected';
  const isBusy = status.state === 'connecting';
  return Menu.buildFromTemplate([
    { label: APP_NAME, enabled: false },
    { label: STATUS_LABEL[status.state], enabled: false },
    { type: 'separator' },
    {
      label: 'Connect',
      enabled: !(isConnected || isBusy),
      click: () => {
        void connect();
      },
    },
    {
      label: 'Disconnect',
      enabled: isConnected || isBusy,
      click: () => {
        void disconnect();
      },
    },
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

function refresh(status: ConnectionStatus): void {
  if (!tray) {
    return;
  }
  tray.setContextMenu(buildMenu(status));
  tray.setToolTip(`${APP_NAME} — ${STATUS_LABEL[status.state]}`);
}

export function createTray(): void {
  tray = new Tray(createTrayIcon());
  // Show the name next to the placeholder icon so the app is easy to spot in
  // the menu bar. TODO: drop once there's a real icon.
  tray.setTitle(APP_NAME);
  refresh(getStatus());
  onStatusChange(refresh);
}
