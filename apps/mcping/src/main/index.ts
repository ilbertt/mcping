import { app, Menu, Tray } from 'electron';
import { createTrayIcon } from './tray-icon';

const APP_NAME = 'mcping';

let tray: Tray | null = null;

function buildTray(): void {
  tray = new Tray(createTrayIcon());
  tray.setToolTip(APP_NAME);
  // Show the name next to the placeholder icon so the app is easy to spot in
  // the menu bar. TODO: drop once there's a real icon.
  tray.setTitle(APP_NAME);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: APP_NAME, enabled: false },
      { type: 'separator' },
      { role: 'quit', label: `Quit ${APP_NAME}` },
    ]),
  );
}

function onReady(): void {
  // Menu-bar only: no Dock icon, no main window.
  app.dock?.hide();
  buildTray();
}

function onFatal(error: unknown): void {
  console.error(`Failed to start ${APP_NAME}`, error);
  app.quit();
}

app.whenReady().then(onReady).catch(onFatal);
