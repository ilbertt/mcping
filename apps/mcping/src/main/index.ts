import { app } from 'electron';
import { registerIpc } from '#main/ipc.ts';
import { createTray } from '#main/tray.ts';
import { APP_NAME } from '#shared/types.ts';

function onReady(): void {
  // Menu-bar only: no Dock icon, no main window on launch.
  app.dock?.hide();
  registerIpc();
  createTray();
}

function onFatal(error: unknown): void {
  console.error(`Failed to start ${APP_NAME}`, error);
  app.quit();
}

app.whenReady().then(onReady).catch(onFatal);
