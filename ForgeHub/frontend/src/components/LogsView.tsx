import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { TerminalSquare } from 'lucide-react';

export const LogsView: React.FC = () => {
  const { modules, setActiveTerminal } = useStore();
  const [selectedModule, setSelectedModule] = useState(modules[0]?.id || 'mina-ia');

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full h-full overflow-y-auto space-y-6 scrollbar-thin animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-forge-text tracking-tight">
          Logs do Sistema
        </h1>
        <p className="text-xs sm:text-sm text-forge-text-secondary mt-0.5">
          Acesse a saída ao vivo do journalctl e logs de execução dos serviços gerenciados.
        </p>
      </div>

      <div className="forge-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-forge-border">
          <div>
            <label className="block text-xs font-semibold text-forge-text-muted uppercase mb-1">
              Selecionar Aplicação ou Serviço
            </label>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="bg-forge-surface-2 border border-forge-border rounded-lg px-3 py-2 text-xs sm:text-sm text-forge-text focus:outline-none focus:border-forge-primary"
            >
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.type || 'systemd'})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setActiveTerminal(selectedModule)}
            className="px-4 py-2.5 rounded-lg bg-forge-primary hover:bg-forge-primary-hover text-forge-bg font-bold text-xs sm:text-sm flex items-center gap-2 self-start sm:self-auto transition-colors shadow-sm"
          >
            <TerminalSquare className="w-4 h-4" />
            <span>Abrir Terminal de Logs em Tempo Real</span>
          </button>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-forge-text-secondary uppercase">
            Informações do Serviço de Log
          </h4>
          <p className="text-xs text-forge-text-muted leading-relaxed">
            O ForgeOS conecta-se via Server-Sent Events (SSE) ao endpoint <code className="text-forge-primary font-mono">/api/modules/{'{id}'}/logs/stream</code>, executando <code className="text-forge-text font-mono">journalctl -u forge-module@{'{id}'} -f -n 10</code> diretamente no sistema operacional da TV Box com zero sobrecarga de memória.
          </p>
        </div>
      </div>
    </div>
  );
};
