import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { StatusBadge } from './StatusBadge';
import { 
  Download, 
  Search, 
  Sparkles, 
  Layers,
  X
} from 'lucide-react';

export const StoreView: React.FC = () => {
  const { modules, installModule, telemetry, setView } = useStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'Todos' | 'AI' | 'Data' | 'Utilities' | 'Media'>('Todos');
  const [installingId, setInstallingId] = useState<string | null>(null);

  const availableRam = telemetry.ramTotal - telemetry.ram;

  // Sorting: featured -> priority -> popularity -> name
  const sortedModules = useMemo(() => {
    return [...modules].sort((a, b) => {
      if ((b.featured ? 1 : 0) !== (a.featured ? 1 : 0)) {
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      }
      if ((b.priority ?? 0) !== (a.priority ?? 0)) {
        return (b.priority ?? 0) - (a.priority ?? 0);
      }
      if ((b.popularity ?? 0) !== (a.popularity ?? 0)) {
        return (b.popularity ?? 0) - (a.popularity ?? 0);
      }
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [modules]);

  const filteredModules = useMemo(() => {
    return sortedModules.filter(m => {
      const matchCat = category === 'Todos' || m.category?.toLowerCase() === category.toLowerCase();
      const matchSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.description.toLowerCase().includes(search.toLowerCase()) ||
        (m.tags && m.tags.some(t => t.toLowerCase().includes(search.toLowerCase())));
      return matchCat && matchSearch;
    });
  }, [sortedModules, category, search]);

  const handleInstall = async (id: string, req: number) => {
    if (availableRam < 300 || req > availableRam) {
      if (!window.confirm(`Atenção: A instalação requer ${req}MB. Há ${availableRam.toFixed(0)}MB livres no appliance. Deseja continuar?`)) {
        return;
      }
    }
    setInstallingId(id);
    installModule(id);
    setTimeout(() => {
      setInstallingId(null);
    }, 600);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto space-y-6 scrollbar-thin animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-forge-text tracking-tight">
            Marketplace
          </h1>
          <p className="text-xs sm:text-sm text-forge-text-secondary mt-0.5">
            Explore, instale e configure novos módulos locais e stacks para sua TV Box.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forge-text-muted" />
          <input 
            type="text" 
            placeholder="Buscar módulos, tags ou recursos..."
            className="w-full bg-forge-surface border border-forge-border rounded-lg pl-9 pr-8 py-2 text-xs text-forge-text placeholder-forge-text-muted focus:outline-none focus:border-forge-primary transition-colors"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-forge-text-muted hover:text-forge-text"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Categories Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-forge-border">
        {([
          { id: 'Todos', label: 'Todos os Módulos' },
          { id: 'AI', label: 'IA & Assistentes' },
          { id: 'Data', label: 'Dados & RAG' },
          { id: 'Utilities', label: 'Utilitários & Campus' },
          { id: 'Media', label: 'Mídia & Kiosk' },
        ] as const).map(c => (
          <button 
            key={c.id}
            onClick={() => setCategory(c.id as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              category === c.id 
                ? 'bg-forge-primary text-forge-bg font-semibold shadow-sm' 
                : 'text-forge-text-secondary hover:text-forge-text hover:bg-forge-surface-2'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid of Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredModules.map(m => {
          const isFeatured = m.featured;
          const isInstalled = m.installed || m.status === 'running';

          return (
            <div 
              key={m.id} 
              className={`forge-card p-5 flex flex-col justify-between transition-all duration-200 ${
                isFeatured 
                  ? 'md:col-span-2 lg:col-span-3 border-forge-primary/40 bg-gradient-to-br from-forge-surface via-forge-surface to-forge-surface-2 shadow-md' 
                  : 'hover:border-forge-border-hover'
              }`}
            >
              <div>
                {/* Header row with Icon, Categories, and Status Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl p-2 rounded-lg bg-forge-surface-2 border border-forge-border">
                      {m.icon || '📦'}
                    </span>
                    <div>
                      {isFeatured && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1">
                          <Sparkles className="w-3 h-3" /> Módulo Principal
                        </span>
                      )}
                      <div className="text-[10px] font-mono text-forge-text-muted uppercase">
                        {m.category} · {m.type || 'systemd'}
                      </div>
                    </div>
                  </div>

                  <StatusBadge 
                    status={m.status === 'running' ? 'running' : isInstalled ? 'installed' : m.stage === 'dev' ? 'dev' : 'available'} 
                  />
                </div>

                {/* Title & Description */}
                <h3 className={`font-semibold text-forge-text ${isFeatured ? 'text-lg sm:text-xl mb-1.5' : 'text-base mb-1'}`}>
                  {m.name}
                </h3>
                <p className="text-xs sm:text-sm text-forge-text-secondary leading-relaxed mb-4">
                  {m.description}
                </p>

                {/* Tags */}
                {m.tags && m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {m.tags.map(tag => (
                      <span 
                        key={tag} 
                        className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-forge-surface-2 text-forge-text-secondary border border-forge-border"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer: Resources and Action Buttons */}
              <div className="pt-3 border-t border-forge-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-auto">
                <div className="flex items-center gap-3 text-[11px] font-mono text-forge-text-muted">
                  <span className={m.ramReq > availableRam ? 'text-amber-400 font-semibold' : ''}>
                    RAM: {m.ramReq} MB
                  </span>
                  <span>Porta: {m.port || 5000}</span>
                  {m.version && <span>v{m.version}</span>}
                </div>

                <div className="flex items-center gap-2">
                  {isInstalled ? (
                    <button 
                      onClick={() => setView('apps')}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-forge-surface-2 hover:bg-forge-surface-3 text-forge-text border border-forge-border transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5 text-forge-primary" />
                      <span>Abrir em Aplicações</span>
                    </button>
                  ) : m.stage === 'dev' ? (
                    <button 
                      disabled
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-forge-surface text-forge-text-muted border border-forge-border cursor-not-allowed"
                    >
                      Em breve
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleInstall(m.id, m.ramReq)}
                      disabled={installingId === m.id}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-forge-primary hover:bg-forge-primary-hover text-forge-bg transition-colors shadow-sm"
                    >
                      <Download className={`w-3.5 h-3.5 ${installingId === m.id ? 'animate-bounce' : ''}`} />
                      <span>{installingId === m.id ? 'Instalando...' : 'Instalar Módulo'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredModules.length === 0 && (
          <div className="col-span-full py-16 text-center text-forge-text-muted text-sm bg-forge-surface/30 rounded-xl border border-dashed border-forge-border">
            Nenhum módulo encontrado com os critérios de busca selecionados.
          </div>
        )}
      </div>
    </div>
  );
};
