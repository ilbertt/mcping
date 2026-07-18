import { app } from 'electron';
import type { Settings } from '#shared/types.ts';

export function syncLoginItem(settings: Settings): void {
  app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
}
