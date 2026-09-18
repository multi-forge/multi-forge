import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { MetricCard } from './MetricCard';
import { StatusBadge } from './StatusBadge';
import { 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Network, 
  Wifi, 
  RefreshCw, 
  ArrowUpRight, 
  Bot, 
  ChevronRight,
  Sparkles,
  Server
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { telemetry, modules, wifiNetworks, fetchScan, setView } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  const availableRamMB = telemetry.ramTotal - telemetry.ram;
  const ramPct = telemetry.ramTotal > 0 ? (telemetry.ram / telemetry.ramTotal) * 100 : 0;
  const diskPct = telemetry.diskTotal > 0 ? (telemetry.disk / telemetry.diskTotal) * 100 : 0;
  const sys = telemetry.systemInfo;

  const loadAvgStr = sys?.load_avg_1 !== undefined
    ? `${sys.load_avg_1.toFixed(2)}, ${sys.load_avg_5?.toFixed(2) || '0.15'}, ${sys.load_avg_15?.toFixed(2) || '0.10'}`
    : '0.10, 0.20, 0.10';

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchScan();
    setTimeout(() => setRefreshing(false), 600);
  };

  // Top 4 apps to showcase
  const featuredApps = modules.slice(0, 4);

  // Top 4 processes from telemetry
  const topProcesses = telemetry.topProcesses?.slice(0, 4) || [
    { pid: 238528, name: 'forgehub', cpu: 0.3, ram: 0.8 },
    { pid: 237281, name: 'qr_screen_dual', cpu: 2.8, ram: 1.7 },
    { pid: 719, name: 'tailscaled', cpu: 0.1, ram: 2.6 },
    { pid: 1, name: 'systemd', cpu: 0.7, ram: 0.7 },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto space-y-6 scrollbar-thin animate-fade-in">
      {/* Header with Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-forge-text tracking-tight">
            Visão geral
          </h1>
          <p className="text-xs sm:text-sm text-forge-text-secondary mt-0.5">
            Tudo pronto para dar o próximo passo no seu appliance ForgeOS.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="px-3 py-1.5 rounded-lg bg-forge-surface border border-forge-border text-[11px] font-mono text-forge-text-secondary flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-forge-primary animate-pulse" />
            <span>Atualizado · 1s</span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forge-surface hover:bg-forge-surface-2 border border-forge-border text-xs font-medium text-forge-text transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-forge-primary' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Hero Banner — "Um novo propósito para sua TV Box" */}
      <div className="forge-card-elevated p-6 sm:p-8 relative overflow-hidden bg-gradient-to-br from-forge-surface via-forge-surface to-forge-surface-2">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Text & CTA */}
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-block text-[10px] sm:text-[11px] font-mono font-bold tracking-widest uppercase text-forge-primary">
              TECNOLOGIA REAPROVEITADA. NOVAS POSSIBILIDADES.
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-forge-text tracking-tight leading-tight">
              Um novo propósito <br className="hidden sm:inline" />
              para sua TV Box.
            </h2>

            <p className="text-xs sm:text-sm text-forge-text-secondary max-w-xl leading-relaxed">
              Execute aplicações modulares, acesse serviços acadêmicos da UNESP e acompanhe 
              métricas do hardware em tempo real com a estabilidade do Linux embarcado.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setView('marketplace')}
                className="px-4 py-2.5 rounded-lg bg-forge-primary hover:bg-forge-primary-hover text-forge-bg font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all"
              >
                <span>Explorar aplicações</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setView('apps')}
                className="px-4 py-2.5 rounded-lg bg-forge-surface-2 hover:bg-forge-surface-3 border border-forge-border text-forge-text font-medium text-xs sm:text-sm flex items-center gap-2 transition-all"
              >
                <Bot className="w-4 h-4 text-forge-primary" />
                <span>Abrir Mina IA</span>
              </button>
            </div>
          </div>

          {/* Right Branding / Device visual */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 border border-forge-border/60 rounded-xl bg-forge-bg/40">
            <div className="w-20 h-20 sm:w-24 sm:h-24 mb-3 flex items-center justify-center">
              <img 
                src="/logo.png" 
                alt="ForgeOS Appliance" 
                className="w-full h-full object-contain drop-shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo-sm.png';
                }} 
              />
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="font-extrabold text-lg text-forge-text tracking-tight">FORGE</span>
                <span className="font-extrabold text-lg text-forge-primary tracking-tight">OS</span>
              </div>
              <p className="text-[10px] font-mono text-forge-text-muted mt-0.5">
                Parte do ecossistema MultiForge
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* "Seu dispositivo" — 4 Compact Metric Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-semibold text-forge-text">
            Seu dispositivo
          </h3>
          <button 
            onClick={() => setView('hardware')} 
            className="text-xs text-forge-primary hover:underline flex items-center gap-1 font-medium"
          >
            <span>Recursos e conectividade</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CPU & Térmico */}
          <MetricCard
            title="Processador & Térmico"
            value={`${telemetry.cpu.toFixed(1)}%`}
            badge={
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {telemetry.temp.toFixed(1)}°C
              </span>
            }
            progressPct={telemetry.cpu}
            progressColor="bg-forge-primary"
            subtitle={`Carga do sistema: ${loadAvgStr}`}
            icon={Cpu}
            onClick={() => setView('hardware')}
          />

          {/* Memória RAM */}
          <MetricCard
            title="Memória RAM"
            value={`${telemetry.ram} MB`}
            unit={`/ ${(telemetry.ramTotal / 1024).toFixed(2)} GB`}
            progressPct={ramPct}
            progressColor={ramPct > 80 ? 'bg-amber-500' : 'bg-forge-primary'}
            subtitle={`${ramPct.toFixed(1)}% em uso (${(availableRamMB / 1024).toFixed(2)} GB livre)`}
            icon={MemoryStick}
            onClick={() => setView('hardware')}
          />

          {/* Armazenamento eMMC */}
          <MetricCard
            title="Armazenamento eMMC"
            value={`${telemetry.disk.toFixed(1)} GB`}
            unit={`/ ${telemetry.diskTotal.toFixed(0)} GB`}
            progressPct={diskPct}
            progressColor="bg-amber-500"
            subtitle={`${diskPct.toFixed(1)}% em uso · Ext4 Rootfs`}
            icon={HardDrive}
            onClick={() => setView('hardware')}
          />

          {/* Tráfego de Rede */}
          <MetricCard
            title="Tráfego de Rede (I/O)"
            value={`↓ ${telemetry.netRx.toFixed(1)} · ↑ ${telemetry.netTx.toFixed(1)}`}
            unit="KB/s"
            progressPct={Math.min(100, telemetry.netRx + telemetry.netTx)}
            progressColor="bg-forge-accent"
            subtitle="ForgeOS (192.168.4.1)"
            icon={Network}
            onClick={() => setView('network')}
          />
        </div>
      </div>

      {/* Featured Applications Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-forge-primary" />
            <h3 className="text-sm sm:text-base font-semibold text-forge-text">
              Aplicações em destaque
            </h3>
          </div>
          <button
            onClick={() => setView('marketplace')}
            className="text-xs text-forge-primary hover:underline flex items-center gap-1 font-medium"
          >
            <span>Ver todas ({modules.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredApps.map((m) => {
            const isInstalled = m.installed || m.status === 'running';
            return (
              <div
                key={m.id}
                onClick={() => setView(isInstalled ? 'apps' : 'marketplace')}
                className="forge-card p-4 flex flex-col justify-between hover:border-forge-border-hover cursor-pointer transition-all duration-200 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{m.icon || '📦'}</span>
                    <StatusBadge status={m.status === 'running' ? 'running' : isInstalled ? 'installed' : 'available'} />
                  </div>
                  <h4 className="font-semibold text-sm text-forge-text group-hover:text-forge-primary transition-colors line-clamp-1">
                    {m.name}
                  </h4>
                  <p className="text-xs text-forge-text-secondary mt-1 line-clamp-2 leading-relaxed">
                    {m.description}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-forge-border flex items-center justify-between text-[11px] font-mono text-forge-text-muted">
                  <span>RAM: {m.ramReq}MB</span>
                  <span className="text-forge-primary group-hover:translate-x-0.5 transition-transform">
                    {isInstalled ? 'Gerenciar →' : 'Instalar →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Row: Redes Wi-Fi Próximas & Processos Ativos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Redes Wi-Fi Próximas */}
        <div className="forge-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-forge-border mb-3">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-forge-primary" />
                <h4 className="font-semibold text-sm text-forge-text">Redes Wi-Fi Próximas</h4>
              </div>
              <button
                onClick={() => setView('network')}
                className="text-xs font-medium text-forge-text-secondary hover:text-forge-text px-2.5 py-1 rounded bg-forge-surface-2 border border-forge-border transition-colors"
              >
                Ver Todas
              </button>
            </div>

            <div className="space-y-2">
              {wifiNetworks.length > 0 ? (
                wifiNetworks.slice(0, 3).map((net) => (
                  <div
                    key={net.ssid}
                    className="p-3 rounded-lg bg-forge-surface-2 border border-forge-border flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-xs text-forge-text flex items-center gap-2">
                        <span>{net.ssid}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-forge-surface text-forge-text-muted border border-forge-border uppercase">
                          {net.encryption}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-forge-text-secondary mt-0.5">
                        Sinal: {net.rssi || -65} dBm {net.channel ? `· Canal ${net.channel}` : ''}
                      </div>
                    </div>

                    <button
                      onClick={() => setView('network')}
                      className="px-3 py-1.5 rounded-md bg-forge-primary hover:bg-forge-primary-hover text-forge-bg text-xs font-semibold transition-colors"
                    >
                      Conectar
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-lg bg-forge-surface-2 border border-forge-border flex items-center justify-between">
                  <div>
                    <div className="font-medium text-xs text-forge-text flex items-center gap-2">
                      <span>Lab "A" d'água</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-forge-surface text-forge-text-muted border border-forge-border">
                        WPA2-PSK
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-forge-text-secondary mt-0.5">
                      Sinal: -45 dBm · Canal 6
                    </div>
                  </div>
                  <button
                    onClick={() => setView('network')}
                    className="px-3 py-1.5 rounded-md bg-forge-primary hover:bg-forge-primary-hover text-forge-bg text-xs font-semibold transition-colors"
                  >
                    Conectar
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-forge-border text-[11px] text-forge-text-muted">
            O Ponto de Acesso Wi-Fi integrado opera em conjunto com a conexão cliente.
          </div>
        </div>

        {/* Processos Ativos (Top 5) */}
        <div className="forge-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-forge-border mb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-forge-primary" />
                <h4 className="font-semibold text-sm text-forge-text">
                  Processos Ativos (Top 4)
                </h4>
              </div>
              <button
                onClick={() => setView('hardware')}
                className="text-xs font-medium text-forge-text-secondary hover:text-forge-text px-2.5 py-1 rounded bg-forge-surface-2 border border-forge-border transition-colors"
              >
                Ver Detalhes
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="forge-table">
                <thead>
                  <tr>
                    <th>PID</th>
                    <th>Processo</th>
                    <th>% CPU</th>
                    <th>% RAM</th>
                  </tr>
                </thead>
                <tbody>
                  {topProcesses.map((p) => (
                    <tr key={p.pid}>
                      <td className="font-mono text-forge-text-muted">{p.pid}</td>
                      <td className="font-semibold text-forge-text">{p.name}</td>
                      <td className="font-mono text-forge-primary">{p.cpu.toFixed(1)}%</td>
                      <td className="font-mono text-forge-text-secondary">{p.ram.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-forge-border text-[11px] text-forge-text-muted flex items-center justify-between">
            <span>Kernel: {sys?.kernel_version || 'Linux 6.18.44-ophub'}</span>
            <span className="text-forge-primary font-mono">Uptime: 13h 15m</span>
          </div>
        </div>
      </div>
    </div>
  );
};
