import { app } from 'electron';
import { registerIpc } from '#main/ipc.ts';
import { syncLoginItem } from '#main/login-item.ts';
import { connectAutoConnectServers, shutdownAll } from '#main/mcp-listener.ts';
import { getSettings } from '#main/settings-store.ts';
import { showSettingsWindow } from '#main/settings-window.ts';
import { createTray } from '#main/tray.ts';
import { APP_NAME } from '#shared/types.ts';

const QUIT_TEARDOWN_TIMEOUT_MS = 2000;

let tornDown = false;

function onReady(): void {
  // Menu-bar only: no Dock icon, no main window on launch.
  app.dock?.hide();
  syncLoginItem(getSettings());
  registerIpc();
  createTray();
  connectAutoConnectServers();
  // A fresh install has no servers to connect to: open Settings so the user can
  // add their first MCP server. Debug builds seed the demo server and skip this.
  if (getSettings().servers.length === 0) {
    showSettingsWindow();
  }
}

function onFatal(error: unknown): void {
  console.error(`Failed to start ${APP_NAME}`, error);
  app.quit();
}

function onBeforeQuit(event: Electron.Event): void {
  if (tornDown) {
    return;
  }
  // Close MCP sessions before quitting, but never let a slow teardown block the
  // quit: race it against a short timeout.
  event.preventDefault();
  tornDown = true;
  const deadline = new Promise<void>((resolve) => {
    setTimeout(resolve, QUIT_TEARDOWN_TIMEOUT_MS);
  });
  void Promise.race([shutdownAll(), deadline]).finally(() => {
    app.quit();
  });
}

function bootstrap(): void {
  app.on('second-instance', () => {
    showSettingsWindow();
  });
  app.on('before-quit', onBeforeQuit);
  app.whenReady().then(onReady).catch(onFatal);
}

// Single instance: a second launch focuses the running app instead of starting
// another tray icon and MCP connection.
if (app.requestSingleInstanceLock()) {
  bootstrap();
} else {
  app.quit();
}
