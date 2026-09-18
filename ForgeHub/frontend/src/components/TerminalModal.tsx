import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { X, Terminal as TerminalIcon } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

export const TerminalModal: React.FC = () => {
  const { activeTerminalModuleId, setActiveTerminal, modules } = useStore();
  const terminalRef = useRef<HTMLDivElement>(null);
  
  const module = modules.find(m => m.id === activeTerminalModuleId);

  useEffect(() => {
    if (!activeTerminalModuleId || !terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#0B0F0E',
        foreground: '#E8EDE9',
        cursor: '#34D399',
        selectionBackground: 'rgba(52, 211, 153, 0.3)',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      convertEol: true
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    term.writeln(`\x1b[32m[INFO]\x1b[0m Conectando ao fluxo de logs do módulo ${module?.name || activeTerminalModuleId}...`);
    
    // Real SSE log stream
    const sse = new EventSource(`/api/modules/${activeTerminalModuleId}/logs/stream`);

    sse.addEventListener('log', (e: MessageEvent) => {
      term.writeln(e.data);
    });

    sse.onmessage = (e: MessageEvent) => {
      term.writeln(e.data);
    };

    sse.onerror = () => {
      term.writeln('\x1b[33m[WARN]\x1b[0m Aguardando novas saídas do processo...');
    };

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      sse.close();
      term.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [activeTerminalModuleId, module]);

  if (!activeTerminalModuleId) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-forge-surface border border-forge-border rounded-2xl shadow-2xl w-full max-w-4xl h-[70vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-forge-border bg-forge-bg">
          <h3 className="font-semibold text-sm sm:text-base text-forge-text flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-forge-primary" />
            <span>Logs em Tempo Real — {module?.name || activeTerminalModuleId}</span>
          </h3>
          <button 
            onClick={() => setActiveTerminal(null)} 
            className="text-forge-text-secondary hover:text-forge-text p-1 rounded-lg hover:bg-forge-surface-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 p-3 bg-forge-bg" ref={terminalRef}></div>
      </div>
    </div>
  );
};
