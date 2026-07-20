import { app } from 'electron';
import type { Settings } from '#shared/settings.ts';

// Only touch the login item when it actually changes: setting it is a no-op that
// still fails noisily on unsigned builds (macOS blocks login items for apps that
// are not signed + notarized), so skip the redundant call on launch.
export function syncLoginItem(settings: Settings): void {
  const current = app.getLoginItemSettings().openAtLogin;
  if (current !== settings.launchAtLogin) {
    app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
  }
}
