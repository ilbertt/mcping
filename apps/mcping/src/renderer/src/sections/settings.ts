import type { Settings } from '#shared/settings.ts';
import { api } from '../lib/api.ts';

type GlobalSettingKey = keyof Omit<Settings, 'servers'>;

function globalInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('[data-setting]'));
}

export function fillGlobalSettings(settings: Settings): void {
  for (const input of globalInputs()) {
    input.checked = settings[input.dataset.setting as GlobalSettingKey];
  }
}

export function wireGlobalSettings(): void {
  for (const input of globalInputs()) {
    input.addEventListener('change', () => {
      const key = input.dataset.setting as GlobalSettingKey;
      void api.setSettings({ [key]: input.checked } as Partial<Omit<Settings, 'servers'>>);
    });
  }
}
