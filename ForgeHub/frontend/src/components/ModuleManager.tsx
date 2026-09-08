import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Play, Square, ExternalLink, TerminalSquare, AlertCircle, Search, X } from 'lucide-react';

export const ModuleManager: React.FC = () => {
  const { modules, startModule, stopModule, setActiveTerminal } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

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
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100">Módulos do Sistema</h2>
          <p className="text-xs text-slate-400 mt-1">Gerencie stacks de execução híbrida (Systemd & Compose)</p>
        </div>

        {/* Status Filter Badges */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Todos ({modules.length})
          </button>
          <button
            onClick={() => setStatusFilter('running')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              statusFilter === 'running'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Ativos ({runningCount})
          </button>
          <button
            onClick={() => setStatusFilter('stopped')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              statusFilter === 'stopped'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Parados ({stoppedCount})
          </button>
        </div>
      </div>

      {/* Dynamic Search Bar */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar módulos por nome, id, tipo (systemd/compose) ou descrição..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition-colors shadow-inner"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {actionError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-4">
        {filteredModules.length > 0 ? (
          filteredModules.map(m => (
          <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-medium text-lg text-slate-200">{m.name}</h3>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                  m.status === 'running' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                  m.status === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                  'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {m.status.toUpperCase()}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                  {m.type || 'systemd'}
                </span>
              </div>
              <p className="text-sm text-slate-400">{m.description}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-mono">
                <span>RAM Mínima: {m.ramReq} MB</span>
                <span>Porta: {m.port || 5000}</span>
                <span>Rota: {m.proxy_path || `/app/${m.id}`}</span>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {m.status === 'running' ? (
                <button 
                  onClick={() => handleStop(m.id)}
                  disabled={loadingId === m.id}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 flex items-center gap-1.5 text-xs font-medium transition-colors" 
                  title="Parar Módulo"
                >
                  <Square className="w-3.5 h-3.5 fill-current" /> Parar
                </button>
              ) : (
                <button 
                  onClick={() => handleStart(m.id)}
                  disabled={loadingId === m.id}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center gap-1.5 text-xs font-medium transition-colors" 
                  title="Iniciar Módulo"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Iniciar
                </button>
              )}

              <a 
                href={`/app/${m.id}/`}
                target="_blank"
                rel="noreferrer"
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  m.status === 'running' 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed pointer-events-none'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir App
              </a>

              <button 
                onClick={() => setActiveTerminal(m.id)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 text-xs font-medium transition-colors" 
                title="Logs em Tempo Real"
              >
                <TerminalSquare className="w-3.5 h-3.5" /> Logs
              </button>
            </div>
          </div>
          ))
        ) : (
          <div className="py-12 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
            {searchTerm || statusFilter !== 'all' ? (
              <div className="flex flex-col items-center gap-2">
                <span>Nenhum módulo encontrado para os filtros selecionados.</span>
                <button
                  onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                  className="text-xs text-cyan-400 hover:underline mt-1 font-medium"
                >
                  Limpar filtros
                </button>
              </div>
            ) : (
              <span>Nenhum módulo registrado no catálogo.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
