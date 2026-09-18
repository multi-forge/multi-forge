import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { StatusBadge } from './StatusBadge';
import { ModuleConfigModal } from './ModuleConfigModal';
import { 
  Play, 
  Square, 
  ExternalLink, 
  TerminalSquare, 
  AlertCircle, 
  Search, 
  X, 
  Sliders
} from 'lucide-react';

export const ModuleManager: React.FC = () => {
  const { modules, startModule, stopModule, setActiveTerminal } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [configModuleId, setConfigModuleId] = useState<string | null>(null);

  const runningCount = modules.filter(m => m.status === 'running').length;
  const stoppedCount = modules.filter(m => m.status !== 'running').length;

  const filteredModules = modules.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.type && m.type.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = 
      statusFilter === 'all' ? true :
      statusFilter === 'running' ? m.status === 'running' :
      m.status !== 'running';
    return matchesSearch && matchesStatus;
  });

  const handleStart = async (id: string) => {
    setLoadingId(id);
    setActionError(null);
    const res = await startModule(id);
    setLoadingId(null);
    if (!res.ok) {
      setActionError(res.error || 'Falha ao iniciar módulo');
    }
  };

  const handleStop = async (id: string) => {
    setLoadingId(id);
    setActionError(null);
    const res = await stopModule(id);
    setLoadingId(null);
    if (!res.ok) {
      setActionError(res.error || 'Falha ao parar módulo');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto space-y-6 scrollbar-thin animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-forge-text tracking-tight">
            Aplicações do Sistema
          </h1>
          <p className="text-xs sm:text-sm text-forge-text-secondary mt-0.5">
            Gerencie e monitore stacks de execução híbrida (Systemd & Docker Compose).
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-forge-surface border border-forge-border rounded-lg text-xs self-start sm:self-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-forge-primary text-forge-bg font-semibold shadow-sm'
                : 'text-forge-text-secondary hover:text-forge-text hover:bg-forge-surface-2'
            }`}
          >
            Todas ({modules.length})
          </button>
          <button
            onClick={() => setStatusFilter('running')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              statusFilter === 'running'
                ? 'bg-emerald-500 text-white font-semibold shadow-sm'
                : 'text-forge-text-secondary hover:text-forge-text hover:bg-forge-surface-2'
            }`}
          >
            Ativas ({runningCount})
          </button>
          <button
            onClick={() => setStatusFilter('stopped')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              statusFilter === 'stopped'
                ? 'bg-forge-surface-3 text-forge-text font-semibold shadow-sm'
                : 'text-forge-text-secondary hover:text-forge-text hover:bg-forge-surface-2'
            }`}
          >
            Paradas ({stoppedCount})
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-forge-text-muted" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar aplicações por nome, id, tipo ou descrição..."
          className="w-full bg-forge-surface border border-forge-border rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-forge-text placeholder-forge-text-muted focus:outline-none focus:border-forge-primary transition-colors shadow-inner"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-forge-text-muted hover:text-forge-text p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error Alert */}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Modules List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredModules.length > 0 ? (
          filteredModules.map(m => {
            const isRunning = m.status === 'running';

            return (
              <div 
                key={m.id} 
                className="forge-card p-4 sm:p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between transition-all hover:border-forge-border-hover"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5 mb-1">
                    <span className="text-xl p-1.5 rounded-lg bg-forge-surface-2 border border-forge-border">
                      {m.icon || '⚙️'}
                    </span>
                    <h3 className="font-semibold text-base sm:text-lg text-forge-text">{m.name}</h3>
                    <StatusBadge status={isRunning ? 'running' : m.status === 'error' ? 'error' : 'stopped'} />
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-forge-surface-2 text-forge-text-muted border border-forge-border">
                      {m.type || 'systemd'}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-forge-text-secondary max-w-2xl leading-relaxed">
                    {m.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-forge-text-muted font-mono">
                    <span>RAM Requerida: {m.ramReq} MB</span>
                    <span>Porta: {m.port || 5000}</span>
                    <span>Rota: {m.proxy_path || `/app/${m.id}`}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-forge-border">
                  {isRunning ? (
                    <button 
                      onClick={() => handleStop(m.id)}
                      disabled={loadingId === m.id}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 flex items-center gap-1.5 text-xs font-medium transition-colors" 
                      title="Parar Aplicação"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>{loadingId === m.id ? 'Parando...' : 'Parar'}</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleStart(m.id)}
                      disabled={loadingId === m.id}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center gap-1.5 text-xs font-medium transition-colors" 
                      title="Iniciar Aplicação"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{loadingId === m.id ? 'Iniciando...' : 'Iniciar'}</span>
                    </button>
                  )}

                  <a 
                    href={`/app/${m.id}/`}
                    target="_blank"
                    rel="noreferrer"
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${
                      isRunning 
                        ? 'bg-forge-primary hover:bg-forge-primary-hover text-forge-bg font-semibold shadow-sm' 
                        : 'bg-forge-surface-2 text-forge-text-muted border border-forge-border cursor-not-allowed pointer-events-none'
                    }`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir App</span>
                  </a>

                  <button 
                    onClick={() => setActiveTerminal(m.id)}
                    className="px-3 py-1.5 rounded-lg bg-forge-surface-2 hover:bg-forge-surface-3 text-forge-text border border-forge-border flex items-center gap-1.5 text-xs font-medium transition-colors" 
                    title="Logs em Tempo Real"
                  >
                    <TerminalSquare className="w-3.5 h-3.5 text-forge-text-muted" />
                    <span>Logs</span>
                  </button>

                  <button 
                    onClick={() => setConfigModuleId(m.id)}
                    className="px-3 py-1.5 rounded-lg bg-forge-surface-2 hover:bg-forge-surface-3 text-forge-primary border border-forge-border hover:border-forge-primary/40 flex items-center gap-1.5 text-xs font-medium transition-colors shadow-sm" 
                    title="Configurar Parâmetros de Execução"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Configurar</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-16 text-center text-forge-text-muted bg-forge-surface/30 rounded-xl border border-dashed border-forge-border">
            {searchTerm || statusFilter !== 'all' ? (
              <div className="flex flex-col items-center gap-2">
                <span>Nenhuma aplicação encontrada para os filtros selecionados.</span>
                <button
                  onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                  className="text-xs text-forge-primary hover:underline mt-1 font-medium"
                >
                  Limpar filtros
                </button>
              </div>
            ) : (
              <span>Nenhuma aplicação registrada no sistema.</span>
            )}
          </div>
        )}
      </div>

      <ModuleConfigModal
        isOpen={!!configModuleId}
        moduleId={configModuleId}
        onClose={() => setConfigModuleId(null)}
        onStart={handleStart}
      />
    </div>
  );
};
