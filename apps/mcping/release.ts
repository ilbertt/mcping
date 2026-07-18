import type { Configuration } from 'electron-builder';
import { build, Platform } from 'electron-builder';

const LS_UI_ELEMENT = 1;

// Signing and notarization are gated behind env vars so a plain `bun run
// release` produces an unsigned build for local testing. Provide CSC_LINK /
// CSC_KEY_PASSWORD (Developer ID cert) and APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD
// / APPLE_TEAM_ID (notarization) in CI to produce a signed + notarized build.
const shouldSign = Boolean(process.env.CSC_LINK || process.env.APPLE_ID);

const config: Configuration = {
  appId: 'com.ilbertt.mcping',
  productName: 'mcping',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: ['dist/**', 'resources/**', 'package.json'],
  mac: {
    category: 'public.app-category.productivity',
    // zip target enables a future electron-updater feed alongside the DMG.
    target: ['dmg', 'zip'],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    // Unsigned local builds skip code signing entirely; when signing env is
    // present, let electron-builder discover the Developer ID certificate.
    identity: shouldSign ? undefined : null,
    notarize: shouldSign,
    extendInfo: {
      // Menu-bar only: no Dock icon for the packaged app (matches app.dock.hide()).
      LSUIElement: LS_UI_ELEMENT,
      NSAppleEventsUsageDescription:
        'mcping opens your chosen AI desktop app to start a new chat from a notification.',
    },
  },
};

await build({ targets: Platform.MAC.createTarget(), config });
