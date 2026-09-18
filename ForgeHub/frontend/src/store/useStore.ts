import { create } from 'zustand';
import { Telemetry, Module, ViewType, ThemeMode, WifiNetwork, WifiProvision } from '../types';

interface AppState {
  view: ViewType;
  setView: (view: ViewType) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  telemetry: Telemetry;
  connected: boolean;
  modules: Module[];
  wifiNetworks: WifiNetwork[];
  activeTerminalModuleId: string | null;
  loading: boolean;
  error: string | null;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveTerminal: (id: string | null) => void;
  fetchModules: () => Promise<void>;
  fetchScan: () => Promise<void>;
  installModule: (id: string) => void;
  startModule: (id: string) => Promise<{ ok: boolean; error?: string }>;
  stopModule: (id: string) => Promise<{ ok: boolean; error?: string }>;
  provisionWifi: (config: WifiProvision) => Promise<{ ok: boolean; message?: string }>;
  resetWifi: () => Promise<void>;
}

const getInitialView = (): ViewType => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view') || window.location.hash.replace('#', '');
    const validViews: ViewType[] = ['home', 'apps', 'marketplace', 'hardware', 'network', 'logs', 'settings'];
    if (validViews.includes(v as ViewType)) {
      return v as ViewType;
    }
    // Backward compat mapping
    if (v === 'dashboard') return 'home';
    if (v === 'store') return 'marketplace';
    if (v === 'manager') return 'apps';
  }
  return 'home';
};

const getInitialTheme = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('forge_theme');
    if (stored === 'light' || stored === 'dark') return stored;
  }
  return 'dark';
};

const applyTheme = (theme: ThemeMode) => {
  if (typeof document !== 'undefined') {
    const html = document.documentElement;
    if (theme === 'light') {
      html.classList.remove('dark');
      html.classList.add('light');
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
    }
    localStorage.setItem('forge_theme', theme);
  }
};

// Apply initial theme
const initialTheme = getInitialTheme();
applyTheme(initialTheme);

export const useStore = create<AppState>((set) => ({
  view: getInitialView(),
  setView: (view) => set({ view }),
  theme: initialTheme,
  toggleTheme: () => set((state) => {
    const next: ThemeMode = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    return { theme: next };
  }),
  telemetry: {
    cpu: 0,
    ram: 0,
    ramTotal: 1805,
    temp: 42,
    disk: 0,
    diskTotal: 29,
    netTx: 0,
    netRx: 0,
  },
  connected: true,
  modules: [
    {
      id: 'mina-ia',
      name: 'Mina — Assistente Virtual Acadêmica',
      description: 'Quiosque de voz inteligente offline com PyQt5, Sherpa-ONNX e wake-word local.',
      status: 'stopped',
      ramReq: 256,
      cpuReq: 15,
      diskReq: 300,
      category: 'ai',
      installed: true,
      port: 5000,
      proxy_path: '/app/mina-ia',
      version: '1.0.0',
      tier: 'stable',
    },
    {
      id: 'web-scraping',
      name: 'Coletor Acadêmico & RAG Agent',
      description: 'Pipeline assíncrono de coleta e RAG com FastAPI, PostgreSQL e Redis.',
      status: 'stopped',
      ramReq: 512,
      cpuReq: 15,
      diskReq: 600,
      category: 'data',
      installed: true,
      port: 8000,
      proxy_path: '/app/web-scraping',
      version: '1.0.0',
      tier: 'stable',
    },
  ],
  wifiNetworks: [],
  activeTerminalModuleId: null,
  loading: false,
  error: null,
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setActiveTerminal: (id) => set({ activeTerminalModuleId: id }),

  fetchModules: async () => {
    try {
      const res = await fetch('/api/modules');
      if (res.ok) {
        const data = await res.json();
        const rawList = data.modules || data.catalog || [];
        const mapped: Module[] = rawList.map((m: any) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          status: m.status || 'stopped',
          ramReq: m.min_ram_mb || 256,
          cpuReq: 15,
          diskReq: m.min_disk_mb || 300,
          category: m.category || 'Utilities',
          installed: m.stage === 'installed' || m.id === 'mina-ia' || m.id === 'web-scraping',
          port: m.port,
          proxy_path: m.proxy_path,
          version: m.version,
          tier: m.tier,
          icon: m.icon,
          featured: m.featured || m.id === 'mina-ia',
          priority: m.priority ?? (m.id === 'mina-ia' ? 100 : 0),
          popularity: m.popularity ?? (m.id === 'mina-ia' ? 95 : 50),
          stage: m.stage || ((m.id === 'mina-ia' || m.id === 'web-scraping') ? 'installed' : 'available'),
          tags: m.tags || [],
        }));
        set({ modules: mapped, error: null });
      }
    } catch (e: any) {
      console.warn('Failed to fetch modules:', e);
    }
  },

  fetchScan: async () => {
    try {
      const res = await fetch('/api/scan');
      if (res.ok) {
        const data = await res.json();
        set({ wifiNetworks: data.networks || [] });
      }
    } catch (e) {
      console.warn('Failed to scan wifi:', e);
    }
  },

  installModule: (id: string) =>
    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === id ? { ...m, installed: true } : m
      ),
    })),

  startModule: async (id: string) => {
    try {
      const res = await fetch(`/api/modules/${id}/start`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.message || data.error || 'Failed to start module' };
      }
      set((state) => ({
        modules: state.modules.map((m) =>
          m.id === id ? { ...m, status: 'running' } : m
        ),
      }));
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Network error' };
    }
  },

  stopModule: async (id: string) => {
    try {
      const res = await fetch(`/api/modules/${id}/stop`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.message || data.error || 'Failed to stop module' };
      }
      set((state) => ({
        modules: state.modules.map((m) =>
          m.id === id ? { ...m, status: 'stopped' } : m
        ),
      }));
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Network error' };
    }
  },

  provisionWifi: async (config: WifiProvision) => {
    try {
      const res = await fetch('/api/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: data.message || data.error || 'Erro ao provisionar' };
      }
      return { ok: true, message: data.message };
    } catch (e: any) {
      return { ok: false, message: e.message || 'Erro de rede' };
    }
  },

  resetWifi: async () => {
    try {
      await fetch('/api/reset', { method: 'POST' });
    } catch (e) {
      console.warn('Failed to reset wifi:', e);
    }
  },
}));

// Real SSE Telemetry Engine
let eventSource: EventSource | null = null;

export const initSSETelemetry = () => {
  if (eventSource) {
    eventSource.close();
  }

  const connect = () => {
    eventSource = new EventSource('/api/events');

    eventSource.onopen = () => {
      useStore.setState({ connected: true });
    };

    eventSource.addEventListener('telemetry', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        useStore.setState({
          connected: true,
          telemetry: {
            cpu: d.cpu_percent ?? d.cpu_pct ?? 0,
            ram: d.ram_used_mb ?? 0,
            ramTotal: d.ram_total_mb ?? 1805,
            temp: d.temp_celsius ?? d.cpu_temp ?? 36.5,
            disk: d.disk_used_gb ?? 0,
            diskTotal: d.disk_total_gb ?? 29,
            netTx: d.net_tx_kbps ?? d.tx_kbs ?? 0,
            netRx: d.net_rx_kbps ?? d.rx_kbs ?? 0,
            cpuCores: d.cpu_cores,
            memoryDetails: d.memory_details,
            disks: d.disks,
            interfaces: d.interfaces,
            topProcesses: d.top_processes,
            systemInfo: d.system_info,
          },
        });
      } catch (err) {
        console.warn('Malformed telemetry SSE event:', err);
      }
    });

    eventSource.onerror = () => {
      useStore.setState({ connected: false });
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      setTimeout(connect, 3000);
    };
  };

  connect();
};
