import type { IpcRendererEvent } from 'electron';
import { contextBridge, ipcRenderer } from 'electron';
import type { LogEntry, McpingApi, ServerStatus } from '#shared/types.ts';
import { IPC } from '#shared/types.ts';

function subscribe<T>(options: { channel: string; listener: (payload: T) => void }): () => void {
  const handler = (...eventArgs: [IpcRendererEvent, T]): void => {
    options.listener(eventArgs[1]);
  };
  ipcRenderer.on(options.channel, handler);
  return () => {
    ipcRenderer.removeListener(options.channel, handler);
  };
}

const api: McpingApi = {
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  setSettings: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch),
  addServer: (draft) => ipcRenderer.invoke(IPC.serversAdd, draft),
  updateServer: (options) => ipcRenderer.invoke(IPC.serversUpdate, options),
  removeServer: (id) => ipcRenderer.invoke(IPC.serversRemove, id),
  connect: (serverId) => ipcRenderer.invoke(IPC.mcpConnect, serverId),
  disconnect: (serverId) => ipcRenderer.invoke(IPC.mcpDisconnect, serverId),
  getStatuses: () => ipcRenderer.invoke(IPC.mcpGetStatuses),
  onStatus: (listener) => subscribe<ServerStatus>({ channel: IPC.mcpStatus, listener }),
  getLog: () => ipcRenderer.invoke(IPC.logGet),
  onLog: (listener) => subscribe<LogEntry>({ channel: IPC.logEntry, listener }),
};

contextBridge.exposeInMainWorld('mcping', api);
