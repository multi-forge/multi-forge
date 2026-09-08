export interface Telemetry {
  cpu: number;
  ram: number;
  ramTotal: number;
  temp: number;
  disk: number;
  diskTotal: number;
  netTx: number;
  netRx: number;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'stopped' | 'error' | 'installing';
  ramReq: number;
  cpuReq: number;
  diskReq: number;
  category: string;
  installed: boolean;
  port?: number;
  proxy_path?: string;
  version?: string;
  tier?: string;
  type?: string;
}

export interface WifiNetwork {
  ssid: string;
  bssid?: string;
  rssi: number;
  channel?: number;
  encryption: string;
}

export type ViewType = 'dashboard' | 'store' | 'manager' | 'hardware';
