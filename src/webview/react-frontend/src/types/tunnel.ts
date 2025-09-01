export interface TunnelInfo {
  id: string;
  name?: string;
  url: string;
  localPort: number;
  pid: number;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  type: 'quick' | 'named';
  token?: string;
  createdAt: Date;
  error?: string;
}

export interface CreateTunnelRequest {
  localPort: number;
  name?: string;
  token?: string;
  type: 'quick' | 'named';
}

export interface TunnelStatus {
  isInstalled: boolean;
  activeTunnels: TunnelInfo[];
  totalCount: number;
}

export interface TunnelOperationResponse {
  success: boolean;
  tunnel?: TunnelInfo;
  error?: string;
}
