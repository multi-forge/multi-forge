export interface CPUCoreMetric {
  core_id: number;
  percent: number;
  freq_mhz?: number;
}

export interface MemoryDetails {
  total_mb: number;
  used_mb: number;
  available_mb: number;
  free_mb: number;
  buffers_mb: number;
  cached_mb: number;
  active_mb: number;
  inactive_mb: number;
  swap_total_mb: number;
  swap_used_mb: number;
  swap_free_mb: number;
  zram_total_mb?: number;
  zram_used_mb?: number;
  zram_compression_ratio?: number;
}

export interface DiskIOMetric {
  device: string;
  mountpoint: string;
  fstype: string;
  medium_type: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  used_pct: number;
  read_kbs: number;
  write_kbs: number;
  total_read_bytes?: number;
  total_write_bytes?: number;
}

export interface NetworkInterfaceMetric {
  name: string;
  state: string;
  ipv4?: string;
  ipv6?: string;
  mac?: string;
  speed_mbps?: number;
  duplex?: string;
  rx_kbs: number;
  tx_kbs: number;
  rx_total_kb: number;
  tx_total_kb: number;
  rx_drops: number;
  tx_drops: number;
  rx_errors: number;
  tx_errors: number;
}

export interface ProcessMetric {
  pid: number;
  name: string;
  user: string;
  cpu: number;
  ram: number;
  rss_mb: number;
  status: string;
  uptime: string;
  command: string;
}

export interface SystemInfoMeta {
  hostname: string;
  os_distribution: string;
  kernel_version: string;
  architecture: string;
  device_model: string;
  soc_family: string;
  cpu_cores: number;
  cur_freq_mhz: number;
  min_freq_mhz: number;
  max_freq_mhz: number;
  load_avg_1: number;
  load_avg_5: number;
  load_avg_15: number;
  uptime_sec: number;
  total_processes: number;
  active_services: number;
  failed_services: number;
  boot_time?: string;
}

export interface Telemetry {
  cpu: number;
  ram: number;
  ramTotal: number;
  temp: number;
  disk: number;
  diskTotal: number;
  netTx: number;
  netRx: number;

  // Linux Appliance Extended
  cpuCores?: CPUCoreMetric[];
  memoryDetails?: MemoryDetails;
  disks?: DiskIOMetric[];
  interfaces?: NetworkInterfaceMetric[];
  topProcesses?: ProcessMetric[];
  systemInfo?: SystemInfoMeta;
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
  icon?: string;
  featured?: boolean;
  priority?: number;
  popularity?: number;
  stage?: 'installed' | 'available' | 'dev' | 'incompatible';
  tags?: string[];
}

export interface WifiNetwork {
  ssid: string;
  bssid?: string;
  rssi: number;
  channel?: number;
  encryption: string;
}

export type ViewType = 'home' | 'apps' | 'marketplace' | 'hardware' | 'network' | 'logs' | 'settings';

export type ThemeMode = 'dark' | 'light';

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
