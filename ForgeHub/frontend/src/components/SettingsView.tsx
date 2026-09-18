import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { 
  Server, 
  Shield, 
  RefreshCw, 
  RotateCcw, 
  Monitor, 
  Wifi, 
  CheckCircle2
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { telemetry, resetWifi } = useStore();
  const [restarting, setRestarting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRestartService = () => {
    if (!window.confirm('Deseja enviar comando para reiniciar o serviço ForgeHub?')) return;
    setRestarting(true);
    setFeedback('Sinal de reinício enviado para o systemd...');
    setTimeout(() => {
      setRestarting(false);
      setFeedback(null);
    }, 4000);
  };

  const handleResetAP = async () => {
    if (!window.confirm('Deseja forçar a restauração do Ponto de Acesso Wi-Fi padrão?')) return;
    await resetWifi();
    setFeedback('Ponto de acesso redefinido com sucesso.');
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full h-full overflow-y-auto space-y-6 scrollbar-thin animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-forge-text tracking-tight">
          Configurações do Sistema
        </h1>
        <p className="text-xs sm:text-sm text-forge-text-secondary mt-0.5">
          Parâmetros do appliance Linux, limites de recursos e preferências do ForgeOS.
        </p>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Identificação & Host */}
        <div className="forge-card p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-forge-border">
            <Server className="w-4 h-4 text-forge-primary" />
            <h3 className="font-semibold text-sm text-forge-text">Identificação do Appliance</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-forge-text-secondary mb-1">Nome do Host</label>
              <input
                type="text"
                readOnly
                value={telemetry.systemInfo?.hostname || 'forgeos-btv'}
                className="w-full bg-forge-surface-2 border border-forge-border rounded-lg px-3 py-2 text-forge-text font-mono text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-forge-text-secondary mb-1">Modelo de Hardware</label>
              <div className="font-mono text-forge-text bg-forge-surface-2 p-2 rounded-lg border border-forge-border">
                {telemetry.systemInfo?.device_model || 'BTV Express E10 (Amlogic S905X2)'}
              </div>
            </div>

            <div>
              <label className="block text-forge-text-secondary mb-1">Distribuição Linux</label>
              <div className="font-mono text-forge-text bg-forge-surface-2 p-2 rounded-lg border border-forge-border">
                {telemetry.systemInfo?.os_distribution || 'Armbian OS 26.08.0 trixie'}
              </div>
            </div>
          </div>
        </div>

        {/* Políticas de Recursos (MemoryGuard) */}
        <div className="forge-card p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-forge-border">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-sm text-forge-text">Proteção de Recursos (MemoryGuard)</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-forge-surface-2 border border-forge-border">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-forge-text">Reserva de Segurança do SO</span>
                <span className="font-mono text-forge-primary font-bold">300 MB</span>
              </div>
              <p className="text-[11px] text-forge-text-muted leading-relaxed">
                Impede que módulos excedam a capacidade da memória RAM e causem OOM Killer no kernel.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-forge-surface-2 border border-forge-border">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-forge-text">Monitor Watchdog Hardware</span>
                <span className="text-emerald-400 font-bold">Ativo</span>
              </div>
              <p className="text-[11px] text-forge-text-muted leading-relaxed">
                Script de contingência (/opt/forgehub/hardware/network/watchdog.sh) monitora conectividade continuamente.
              </p>
            </div>
          </div>
        </div>

        {/* Display & HDMI Kiosk */}
        <div className="forge-card p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-forge-border">
            <Monitor className="w-4 h-4 text-forge-accent" />
            <h3 className="font-semibold text-sm text-forge-text">Saída HDMI & Resolução</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-2 border-b border-forge-border/60">
              <span className="text-forge-text-secondary">Framebuffer Ativo</span>
              <span className="font-mono text-forge-text font-bold">/dev/fb0</span>
            </div>
            <div className="flex justify-between py-2 border-b border-forge-border/60">
              <span className="text-forge-text-secondary">Resolução do Totem</span>
              <span className="font-mono text-forge-text font-bold">1920 × 1080 (1080p)</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-forge-text-secondary">Proteção Anti-burnin</span>
              <span className="font-mono text-emerald-400 font-bold">Pixel-shift Sinusoidal (±2px)</span>
            </div>
          </div>
        </div>

        {/* Ações Administrativas */}
        <div className="forge-card p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-forge-border">
            <RefreshCw className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-sm text-forge-text">Operações de Manutenção</h3>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={handleResetAP}
              className="w-full px-4 py-2.5 rounded-lg bg-forge-surface-2 hover:bg-forge-surface-3 border border-forge-border text-xs font-medium text-forge-text flex items-center justify-between transition-colors"
            >
              <span>Restaurar Ponto de Acesso (AP Mode)</span>
              <Wifi className="w-4 h-4 text-forge-primary" />
            </button>

            <button
              onClick={handleRestartService}
              disabled={restarting}
              className="w-full px-4 py-2.5 rounded-lg bg-forge-surface-2 hover:bg-forge-surface-3 border border-forge-border text-xs font-medium text-forge-text flex items-center justify-between transition-colors"
            >
              <span>{restarting ? 'Reiniciando daemon...' : 'Reiniciar Serviço ForgeHub'}</span>
              <RotateCcw className={`w-4 h-4 text-amber-400 ${restarting ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
