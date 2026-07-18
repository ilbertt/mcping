import { Menu, Tray } from 'electron';
import { showSettingsWindow } from '#main/settings-window.ts';
import { createTrayIcon } from '#main/tray-icon.ts';
import { APP_NAME } from '#shared/types.ts';

let tray: Tray | null = null;

function buildMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: APP_NAME, enabled: false },
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

export function createTray(): void {
  tray = new Tray(createTrayIcon());
  tray.setToolTip(APP_NAME);
  // Show the name next to the placeholder icon so the app is easy to spot in
  // the menu bar. TODO: drop once there's a real icon.
  tray.setTitle(APP_NAME);
  tray.setContextMenu(buildMenu());
}
