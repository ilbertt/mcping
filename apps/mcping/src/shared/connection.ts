export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionStatus {
  state: ConnectionState;
  detail?: string;
}

export interface ServerStatus {
  serverId: string;
  status: ConnectionStatus;
}
