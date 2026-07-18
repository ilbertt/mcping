import { join } from 'node:path';
import type { NativeImage } from 'electron';
import { app, nativeImage } from 'electron';

// TODO: replace this placeholder dot with real mcping branding.
// The adjacent iconTemplate@2x.png is picked up automatically on Retina displays.
export function createTrayIcon(): NativeImage {
  const iconPath = join(app.getAppPath(), 'resources', 'iconTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);
  return icon;
}
