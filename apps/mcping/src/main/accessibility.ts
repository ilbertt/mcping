import { shell, systemPreferences } from 'electron';
import type { AccessibilityStatus } from '#shared/types.ts';

const ACCESSIBILITY_PANE =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';

// prompt: true asks macOS to surface the system permission dialog; false is a
// silent status read. The permission is tied to the (signed) app bundle, so a
// dev/unsigned build and the released app are granted independently.
export function checkAccessibility(options?: { prompt?: boolean }): AccessibilityStatus {
  const prompt = options?.prompt ?? false;
  const trusted = systemPreferences.isTrustedAccessibilityClient(prompt);
  return { trusted };
}

export function openAccessibilitySettings(): Promise<void> {
  return shell.openExternal(ACCESSIBILITY_PANE);
}
