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

export interface WifiProvision {
  ssid: string;
  type: 'open' | 'psk' | 'sae' | 'owe' | 'eap';
  password?: string;
  identity?: string;
  method?: 'PEAP' | 'TTLS' | 'PWD' | 'TLS';
  phase2?: string;
  anonymous_identity?: string;
  domain?: string;
  ca_cert?: string;
  client_cert?: string;
  private_key?: string;
}
