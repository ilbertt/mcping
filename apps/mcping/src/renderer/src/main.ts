import './styles.css';
import { api } from './lib/api.ts';
import { requireElement } from './lib/dom.ts';
import { renderLogEntry, wireCopyLog } from './sections/log-panel.ts';
import { addServer, findCard, renderServers, updateCardStatus } from './sections/server-card.ts';
import { fillGlobalSettings, wireGlobalSettings } from './sections/settings.ts';

async function init(): Promise<void> {
  fillGlobalSettings(await api.getSettings());
  wireGlobalSettings();

  await renderServers();
  requireElement<HTMLButtonElement>('#add-server').addEventListener('click', () => {
    void addServer();
  });
  api.onStatus((entry) => {
    const card = findCard(entry.serverId);
    if (card) {
      updateCardStatus({ card, status: entry.status });
    }
  });

  wireCopyLog();
  for (const entry of await api.getLog()) {
    renderLogEntry(entry);
  }
  api.onLog(renderLogEntry);
}

void init();
