import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { 
  Cpu, 
  MemoryStick, 
  Thermometer, 
  HardDrive, 
  Network, 
  Server, 
  Activity, 
  ArrowDown, 
  ArrowUp
} from 'lucide-react';

// Discreet SVG Sparkline
const Sparkline: React.FC<{ data: number[]; max?: number; color?: string; height?: number }> = ({ 
  data, 
  max, 
  color = '#34D399', 
  height = 28 
}) => {
  if (data.length < 2) return <div style={{ height }} className="w-full bg-forge-surface-2 rounded" />;

  const effectiveMax = max || Math.max(...data, 1);
  const width = 120;
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - (Math.min(val, effectiveMax) / effectiveMax) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible" style={{ height }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

export const TelemetryDashboard: React.FC = () => {
  const { telemetry } = useStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'network' | 'storage' | 'processes' | 'hardware'>('overview');
  const [procSort, setProcSort] = useState<'ram' | 'cpu'>('ram');

  // Ring buffer 60 points
  const historyRef = useRef<{
    cpu: number[];
    ram: number[];
    temp: number[];
    netRx: number[];
    netTx: number[];
  }>({
    cpu: [],
    ram: [],
    temp: [],
    netRx: [],
    netTx: [],
  });

  const [, setTick] = useState(0);

  useEffect(() => {
    const hist = historyRef.current;
    const pushPoint = (arr: number[], val: number) => {
      arr.push(val);
      if (arr.length > 60) arr.shift();
    };

    pushPoint(hist.cpu, telemetry.cpu);
    pushPoint(hist.ram, telemetry.ram);
    pushPoint(hist.temp, telemetry.temp);
    pushPoint(hist.netRx, telemetry.netRx);
    pushPoint(hist.netTx, telemetry.netTx);

    setTick(t => t + 1);
  }, [telemetry]);

  const hist = historyRef.current;
  const mem = telemetry.memoryDetails;
  const sys = telemetry.systemInfo;
  const cores = telemetry.cpuCores || [];
  const disks = telemetry.disks || [];
  const ifaces = telemetry.interfaces || [];
  const processes = telemetry.topProcesses || [];

  const sortedProcesses = [...processes].sort((a, b) => {
    if (procSort === 'ram') return b.ram - a.ram;
    return b.cpu - a.cpu;
  });

  const formatUptime = (sec: number) => {
    if (!sec || sec <= 0) return 'Indisponível';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto space-y-6 scrollbar-thin animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-forge-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-forge-text tracking-tight">
            Hardware & Telemetria
          </h1>
          <p className="text-xs sm:text-sm text-forge-text-secondary mt-0.5">
            Métricas de baixo nível do kernel Linux e hardware embarcado Armbian (BTV E10).
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto text-[11px] font-mono text-forge-text-secondary bg-forge-surface px-3 py-1.5 rounded-lg border border-forge-border">
          <span className="w-2 h-2 rounded-full bg-forge-primary animate-pulse" />
          <span>Amostragem: ~1.0 s</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide border-b border-forge-border">
        {[
          { id: 'overview', label: 'Visão geral', icon: Activity },
          { id: 'network', label: 'Rede & Interfaces', icon: Network },
          { id: 'storage', label: 'Armazenamento', icon: HardDrive },
          { id: 'processes', label: 'Processos', icon: Server },
          { id: 'hardware', label: 'Info do Hardware', icon: Cpu },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-forge-primary text-forge-bg font-semibold shadow-sm'
                  : 'text-forge-text-secondary hover:text-forge-text hover:bg-forge-surface'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 5 Quick Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* CPU */}
            <div className="forge-card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-forge-text-secondary mb-2">
                <span className="text-xs font-medium">Uso da CPU</span>
                <Cpu className="w-4 h-4 text-forge-primary" />
              </div>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-2xl font-bold text-forge-text tracking-tight">{telemetry.cpu.toFixed(1)}</span>
                <span className="text-xs font-mono text-forge-text-muted">%</span>
              </div>
              <div className="mt-2">
                <Sparkline data={hist.cpu} max={100} color="#34D399" height={24} />
              </div>
              <span className="text-[10px] font-mono text-forge-text-muted mt-1">4 núcleos ativos</span>
            </div>

            {/* RAM */}
            <div className="forge-card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-forge-text-secondary mb-2">
                <span className="text-xs font-medium">Memória RAM</span>
                <MemoryStick className="w-4 h-4 text-forge-accent" />
              </div>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-2xl font-bold text-forge-text tracking-tight">{telemetry.ram}</span>
                <span className="text-xs font-mono text-forge-text-muted">/ {telemetry.ramTotal} MB</span>
              </div>
              <div className="mt-2">
                <Sparkline data={hist.ram} max={telemetry.ramTotal} color="#22D3EE" height={24} />
              </div>
              <span className="text-[10px] font-mono text-forge-text-muted mt-1">
                {((telemetry.ram / telemetry.ramTotal) * 100).toFixed(0)}% alocada
              </span>
            </div>

            {/* Temp */}
            <div className="forge-card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-forge-text-secondary mb-2">
                <span className="text-xs font-medium">Temperatura</span>
                <Thermometer className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-2xl font-bold text-forge-text tracking-tight">{telemetry.temp.toFixed(1)}</span>
                <span className="text-xs font-mono text-forge-text-muted">°C</span>
              </div>
              <div className="mt-2">
                <Sparkline data={hist.temp} max={85} color="#10B981" height={24} />
              </div>
              <span className="text-[10px] font-mono text-forge-text-muted mt-1">SoC S905X2</span>
            </div>

            {/* Storage */}
            <div className="forge-card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-forge-text-secondary mb-2">
                <span className="text-xs font-medium">Armazenamento</span>
                <HardDrive className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-2xl font-bold text-forge-text tracking-tight">{telemetry.disk.toFixed(1)}</span>
                <span className="text-xs font-mono text-forge-text-muted">/ {telemetry.diskTotal.toFixed(0)} GB</span>
              </div>
              <div className="w-full bg-forge-surface-3 rounded-full h-1.5 mt-4 overflow-hidden">
                <div 
                  className="bg-amber-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${(telemetry.disk / telemetry.diskTotal) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-forge-text-muted mt-1">eMMC Flash</span>
            </div>

            {/* Network */}
            <div className="forge-card p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-forge-text-secondary mb-2">
                <span className="text-xs font-medium">Tráfego Rede</span>
                <Network className="w-4 h-4 text-purple-400" />
              </div>
              <div className="grid grid-cols-2 gap-2 my-1 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-forge-text-muted flex items-center gap-0.5"><ArrowDown className="w-2.5 h-2.5 text-emerald-400" /> RX</span>
                  <span className="text-sm font-semibold text-forge-text">{telemetry.netRx.toFixed(0)} <span className="text-[9px] text-forge-text-muted">KB/s</span></span>
                </div>
                <div>
                  <span className="text-[10px] text-forge-text-muted flex items-center gap-0.5"><ArrowUp className="w-2.5 h-2.5 text-cyan-400" /> TX</span>
                  <span className="text-sm font-semibold text-forge-text">{telemetry.netTx.toFixed(0)} <span className="text-[9px] text-forge-text-muted">KB/s</span></span>
                </div>
              </div>
              <div className="mt-2">
                <Sparkline data={hist.netRx} color="#C084FC" height={24} />
              </div>
              <span className="text-[10px] font-mono text-forge-text-muted mt-1">eth0 + wlan0</span>
            </div>
          </div>

          {/* 2 Dense Blocks: Cores & Memory Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* CPU Cores */}
            <div className="forge-card p-5">
              <div className="flex items-center justify-between pb-3 border-b border-forge-border mb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-forge-primary" />
                  <h3 className="font-semibold text-sm text-forge-text">Núcleos de Processamento (4x Cortex-A53)</h3>
                </div>
                {sys && (
                  <span className="text-[11px] font-mono text-forge-text-muted">
                    Freq: {sys.cur_freq_mhz ? `${sys.cur_freq_mhz.toFixed(0)} MHz` : '1704 MHz'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {cores.length > 0 ? cores.map((c, i) => (
                  <div key={i} className="bg-forge-surface-2 border border-forge-border rounded-lg p-3">
                    <div className="flex justify-between items-center text-[11px] font-mono text-forge-text-secondary mb-1">
                      <span>Core {c.core_id}</span>
                      <span className="text-forge-text font-bold">{c.percent.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-forge-surface-3 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-forge-primary h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, c.percent))}%` }}
                      />
                    </div>
                  </div>
                )) : (
                  [0, 1, 2, 3].map(i => (
                    <div key={i} className="bg-forge-surface-2 border border-forge-border rounded-lg p-3">
                      <div className="flex justify-between items-center text-[11px] font-mono text-forge-text-secondary mb-1">
                        <span>Core {i}</span>
                        <span className="text-forge-text font-bold">{telemetry.cpu.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-forge-surface-3 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-forge-primary h-full rounded-full" style={{ width: `${telemetry.cpu}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Load Average */}
              <div className="flex items-center justify-between text-xs bg-forge-surface-2 border border-forge-border rounded-lg px-3.5 py-2.5">
                <span className="text-forge-text-secondary">Carga Média do Sistema:</span>
                <div className="flex gap-4 font-mono text-forge-text">
                  <span>1m: <strong className="text-forge-primary">{sys?.load_avg_1 ? sys.load_avg_1.toFixed(2) : '0.15'}</strong></span>
                  <span>5m: <strong className="text-forge-text">{sys?.load_avg_5 ? sys.load_avg_5.toFixed(2) : '0.18'}</strong></span>
                  <span>15m: <strong className="text-forge-text-muted">{sys?.load_avg_15 ? sys.load_avg_15.toFixed(2) : '0.12'}</strong></span>
                </div>
              </div>
            </div>

            {/* Memory Kernel Details */}
            <div className="forge-card p-5">
              <div className="flex items-center justify-between pb-3 border-b border-forge-border mb-4">
                <div className="flex items-center gap-2">
                  <MemoryStick className="w-4 h-4 text-forge-accent" />
                  <h3 className="font-semibold text-sm text-forge-text">Alocação de Memória Física (/proc/meminfo)</h3>
                </div>
                <span className="text-[11px] font-mono text-forge-text-muted">Total: {telemetry.ramTotal} MB</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono mb-3">
                <div className="bg-forge-surface-2 p-2.5 rounded-lg border border-forge-border">
                  <span className="text-[10px] text-forge-text-muted block">Em Uso</span>
                  <span className="text-forge-text font-bold">{telemetry.ram} MB</span>
                </div>
                <div className="bg-forge-surface-2 p-2.5 rounded-lg border border-forge-border">
                  <span className="text-[10px] text-forge-text-muted block">Disponível</span>
                  <span className="text-emerald-400 font-bold">{mem?.available_mb || (telemetry.ramTotal - telemetry.ram)} MB</span>
                </div>
                <div className="bg-forge-surface-2 p-2.5 rounded-lg border border-forge-border">
                  <span className="text-[10px] text-forge-text-muted block">Livre (Zero)</span>
                  <span className="text-forge-text font-bold">{mem?.free_mb || 1250} MB</span>
                </div>
                <div className="bg-forge-surface-2 p-2.5 rounded-lg border border-forge-border">
                  <span className="text-[10px] text-forge-text-muted block">Buffers</span>
                  <span className="text-forge-text font-bold">{mem?.buffers_mb || 52} MB</span>
                </div>
                <div className="bg-forge-surface-2 p-2.5 rounded-lg border border-forge-border">
                  <span className="text-[10px] text-forge-text-muted block">Cache de Disco</span>
                  <span className="text-forge-text font-bold">{mem?.cached_mb || 256} MB</span>
                </div>
                <div className="bg-forge-surface-2 p-2.5 rounded-lg border border-forge-border">
                  <span className="text-[10px] text-forge-text-muted block">Swap / ZRAM</span>
                  <span className="text-forge-text-muted font-bold">{mem?.swap_total_mb ? `${mem.swap_used_mb}/${mem.swap_total_mb} MB` : 'Desativado'}</span>
                </div>
              </div>

              <div className="text-[11px] text-forge-text-muted bg-forge-surface-2 p-2.5 rounded-lg border border-forge-border">
                A memória disponível inclui memória livre e páginas de cache reutilizáveis sem causar swap.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NETWORK */}
      {activeTab === 'network' && (
        <div className="space-y-6">
          <div className="forge-card p-5">
            <h3 className="font-semibold text-base text-forge-text mb-3 flex items-center gap-2">
              <Network className="w-4 h-4 text-forge-primary" />
              Interfaces de Rede Físicas e Virtuais
            </h3>
            <div className="overflow-x-auto">
              <table className="forge-table">
                <thead>
                  <tr>
                    <th>Interface</th>
                    <th>Estado</th>
                    <th>Velocidade</th>
                    <th>RX Total</th>
                    <th>TX Total</th>
                    <th>Drops (RX/TX)</th>
                    <th>Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {ifaces.length > 0 ? ifaces.map((iface) => (
                    <tr key={iface.name}>
                      <td className="font-bold text-forge-text">{iface.name}</td>
                      <td>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                          {iface.state}
                        </span>
                      </td>
                      <td className="font-mono text-forge-text-secondary">{iface.speed_mbps ? `${iface.speed_mbps} Mbps` : 'Auto'}</td>
                      <td className="font-mono text-forge-text">{(iface.rx_total_kb / 1024).toFixed(1)} MB</td>
                      <td className="font-mono text-forge-text">{(iface.tx_total_kb / 1024).toFixed(1)} MB</td>
                      <td className="font-mono text-forge-text-muted">{iface.rx_drops} / {iface.tx_drops}</td>
                      <td className="font-mono text-forge-text-muted">{iface.rx_errors + iface.tx_errors}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="font-bold text-forge-text">eth0</td>
                      <td><span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400">UP</span></td>
                      <td className="font-mono text-forge-text-secondary">100 Mbps</td>
                      <td className="font-mono text-forge-text">42.5 MB</td>
                      <td className="font-mono text-forge-text">18.2 MB</td>
                      <td className="font-mono text-forge-text-muted">0 / 0</td>
                      <td className="font-mono text-forge-text-muted">0</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STORAGE */}
      {activeTab === 'storage' && (
        <div className="space-y-6">
          <div className="forge-card p-5">
            <h3 className="font-semibold text-base text-forge-text mb-3 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-400" />
              Dispositivos de Armazenamento & Filesystems
            </h3>
            <div className="overflow-x-auto">
              <table className="forge-table">
                <thead>
                  <tr>
                    <th>Dispositivo</th>
                    <th>Montagem</th>
                    <th>Tipo / Mídia</th>
                    <th>Capacidade</th>
                    <th>Usado</th>
                    <th>Livre</th>
                    <th className="text-right">Uso %</th>
                  </tr>
                </thead>
                <tbody>
                  {disks.length > 0 ? disks.map((d, idx) => (
                    <tr key={idx}>
                      <td className="font-bold text-forge-text">{d.device}</td>
                      <td className="text-forge-primary">{d.mountpoint}</td>
                      <td><span className="px-1.5 py-0.5 rounded bg-forge-surface-2 border border-forge-border text-[10px]">{d.medium_type} ({d.fstype})</span></td>
                      <td>{d.total_gb} GB</td>
                      <td>{d.used_gb} GB</td>
                      <td className="text-emerald-400">{d.free_gb} GB</td>
                      <td className="text-right font-bold">{d.used_pct.toFixed(0)}%</td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="font-bold text-forge-text">/dev/mmcblk1p2</td>
                      <td className="text-forge-primary">/</td>
                      <td><span className="px-1.5 py-0.5 rounded bg-forge-surface-2 border border-forge-border text-[10px]">eMMC (ext4)</span></td>
                      <td>29.0 GB</td>
                      <td>6.9 GB</td>
                      <td className="text-emerald-400">22.1 GB</td>
                      <td className="text-right font-bold">24%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PROCESSES */}
      {activeTab === 'processes' && (
        <div className="space-y-6">
          <div className="forge-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-forge-border">
              <h3 className="font-semibold text-base text-forge-text flex items-center gap-2">
                <Server className="w-4 h-4 text-forge-primary" />
                Processos do Sistema
              </h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-forge-text-muted">Ordenar por:</span>
                <button
                  onClick={() => setProcSort('ram')}
                  className={`px-2.5 py-1 rounded-md font-mono ${
                    procSort === 'ram' ? 'bg-forge-primary text-forge-bg font-bold' : 'bg-forge-surface-2 text-forge-text-secondary'
                  }`}
                >
                  RAM
                </button>
                <button
                  onClick={() => setProcSort('cpu')}
                  className={`px-2.5 py-1 rounded-md font-mono ${
                    procSort === 'cpu' ? 'bg-forge-primary text-forge-bg font-bold' : 'bg-forge-surface-2 text-forge-text-secondary'
                  }`}
                >
                  CPU
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="forge-table">
                <thead>
                  <tr>
                    <th>PID</th>
                    <th>Processo</th>
                    <th>Usuário</th>
                    <th>% CPU</th>
                    <th>% RAM</th>
                    <th>RSS MB</th>
                    <th>Status</th>
                    <th>Uptime</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProcesses.map((p) => (
                    <tr key={p.pid}>
                      <td className="font-mono text-forge-text-muted">{p.pid}</td>
                      <td className="font-bold text-forge-text">{p.name}</td>
                      <td className="text-forge-text-secondary">{p.user}</td>
                      <td className="font-mono text-forge-primary font-bold">{p.cpu.toFixed(1)}%</td>
                      <td className="font-mono text-forge-accent font-bold">{p.ram.toFixed(1)}%</td>
                      <td className="font-mono text-forge-text">{p.rss_mb.toFixed(1)}</td>
                      <td><span className="px-1.5 py-0.5 rounded bg-forge-surface-2 text-[10px] font-mono">{p.status}</span></td>
                      <td className="text-forge-text-muted">{p.uptime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: HARDWARE */}
      {activeTab === 'hardware' && (
        <div className="space-y-6">
          <div className="forge-card p-6">
            <h3 className="font-semibold text-base text-forge-text mb-4 pb-3 border-b border-forge-border flex items-center gap-2">
              <Cpu className="w-4 h-4 text-forge-primary" />
              Especificações do Host & Kernel
            </h3>

            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs sm:text-sm">
              <div className="flex justify-between py-2 border-b border-forge-border/60">
                <dt className="text-forge-text-secondary">Hostname</dt>
                <dd className="font-mono text-forge-text font-bold">{sys?.hostname || 'forgeos-btv'}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-forge-border/60">
                <dt className="text-forge-text-secondary">Modelo de Hardware</dt>
                <dd className="font-mono text-forge-text font-bold">{sys?.device_model || 'BTV Express E10 (Amlogic S905X2)'}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-forge-border/60">
                <dt className="text-forge-text-secondary">Distribuição Linux</dt>
                <dd className="font-mono text-forge-text font-bold">{sys?.os_distribution || 'Armbian OS 26.08.0 trixie'}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-forge-border/60">
                <dt className="text-forge-text-secondary">Kernel Linux</dt>
                <dd className="font-mono text-forge-text font-bold">{sys?.kernel_version || '6.18.44-ophub (aarch64)'}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-forge-border/60">
                <dt className="text-forge-text-secondary">Arquitetura</dt>
                <dd className="font-mono text-forge-text font-bold">{sys?.architecture || 'aarch64 (ARMv8 64-bit)'}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-forge-border/60">
                <dt className="text-forge-text-secondary">SoC</dt>
                <dd className="font-mono text-forge-text font-bold">{sys?.soc_family || 'Amlogic S905X2 (4x Cortex-A53)'}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-forge-border/60">
                <dt className="text-forge-text-secondary">Tempo Ativo (Uptime)</dt>
                <dd className="font-mono text-emerald-400 font-bold">{formatUptime(sys?.uptime_sec || 48000)}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-forge-border/60">
                <dt className="text-forge-text-secondary">Serviços do Sistema</dt>
                <dd className="font-mono text-forge-text font-bold">
                  <span className="text-emerald-400">{sys?.active_services || 15} ativos</span> · <span className="text-forge-text-muted">{sys?.failed_services || 0} falhos</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};
