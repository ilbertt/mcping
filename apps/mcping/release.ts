import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { type AfterPackContext, build, type Configuration, Platform } from 'electron-builder';

const execFileAsync = promisify(execFile);

const LS_UI_ELEMENT = 1;
const APP_ID = 'com.ilbertt.mcping';
const PRODUCT_NAME = 'mcping';

// No Developer ID for now: every build is ad-hoc signed locally. electron-builder
// skips its own signing (identity: null) and this hook re-signs the packed .app
// with the bundle id as the signing identifier. Without it the app keeps the
// Electron binary's default "Electron" signing identity, and macOS won't deliver
// notifications — authorization is keyed to the signing identity, not the bundle id.
const adhocSign = async (context: AfterPackContext): Promise<void> => {
  const appPath = join(context.appOutDir, `${PRODUCT_NAME}.app`);
  await execFileAsync('codesign', [
    '--force',
    '--deep',
    '--sign',
    '-',
    '--identifier',
    APP_ID,
    appPath,
  ]);
};

const config: Configuration = {
  appId: APP_ID,
  productName: PRODUCT_NAME,
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: ['dist/**', 'resources/**', 'package.json'],
  afterPack: adhocSign,
  mac: {
    category: 'public.app-category.productivity',
    icon: 'build/icon.png',
    // zip target enables a future electron-updater feed alongside the DMG.
    target: ['dmg', 'zip'],
    identity: null,
    extendInfo: {
      // Menu-bar only: no Dock icon for the packaged app (matches app.dock.hide()).
      LSUIElement: LS_UI_ELEMENT,
      NSAppleEventsUsageDescription:
        'mcping opens your chosen AI desktop app to start a new chat from a notification.',
    },
  },
};

await build({ targets: Platform.MAC.createTarget(), config });
