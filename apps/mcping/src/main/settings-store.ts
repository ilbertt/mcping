import Store from 'electron-store';
import type { Settings } from '#shared/types.ts';
import { DEFAULT_SETTINGS } from '#shared/types.ts';

let store: Store<Settings> | null = null;

function requireStore(): Store<Settings> {
  if (!store) {
    store = new Store<Settings>({ defaults: DEFAULT_SETTINGS });
  }
  return store;
}

export function getSettings(): Settings {
  return requireStore().store;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next: Settings = { ...requireStore().store, ...patch };
  requireStore().store = next;
  return next;
}
