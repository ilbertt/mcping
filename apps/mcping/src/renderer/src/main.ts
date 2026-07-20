import './styles.css';
import { api } from './lib/api.ts';
import { renderLogEntry, wireCopyLog } from './sections/log-panel.ts';
import { applyServerStatus, renderServers, wireAddServer } from './sections/server-card.ts';
import { fillGlobalSettings, wireGlobalSettings } from './sections/settings.ts';

async function init(): Promise<void> {
  fillGlobalSettings(await api.getSettings());
  wireGlobalSettings();

  await renderServers();
  wireAddServer();
  api.onStatus(applyServerStatus);

  wireCopyLog();
  for (const entry of await api.getLog()) {
    renderLogEntry(entry);
  }
  api.onLog(renderLogEntry);
}

void init();
