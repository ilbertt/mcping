import { join } from 'node:path';
import type { NativeImage } from 'electron';
import { app, nativeImage } from 'electron';

// Monochrome "ping" (broadcast waves) template image; macOS tints it for
// light/dark menu bars. The adjacent iconTemplate@2x.png is used on Retina.
export function createTrayIcon(): NativeImage {
  const iconPath = join(app.getAppPath(), 'resources', 'iconTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);
  return icon;
}
