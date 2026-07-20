import { join } from 'node:path';
import { app, BrowserWindow, shell } from 'electron';
import { APP_NAME } from '#shared/app.ts';

const WINDOW_WIDTH = 460;
const WINDOW_HEIGHT = 640;

let window: BrowserWindow | null = null;
let quitting = false;

app.on('before-quit', () => {
  quitting = true;
});

function loadRenderer(target: BrowserWindow): void {
  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (devServerUrl) {
    void target.loadURL(devServerUrl);
  } else {
    void target.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  }
}

function createWindow(): BrowserWindow {
  const created = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    show: false,
    resizable: false,
    fullscreenable: false,
    title: `${APP_NAME} settings`,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Hide instead of destroying so the renderer keeps its IPC subscriptions and
  // reopens instantly. Real teardown happens on app quit.
  created.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      created.hide();
    }
  });

  created.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: 'deny' };
  });

  loadRenderer(created);
  return created;
}

export function showSettingsWindow(): void {
  if (!window) {
    window = createWindow();
  }
  window.show();
  window.focus();
}

export function getSettingsWindow(): BrowserWindow | null {
  return window;
}
