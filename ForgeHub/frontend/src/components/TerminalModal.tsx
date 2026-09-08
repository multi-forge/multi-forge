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
        background: '#0B0F17',
        foreground: '#e2e8f0',
        cursor: '#3b82f6',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      convertEol: true
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    term.writeln(`\x1b[34m[INFO]\x1b[0m Connecting to live log stream for ${module?.name || activeTerminalModuleId}...`);
    
    // Real SSE log connection
    const sse = new EventSource(`/api/modules/${activeTerminalModuleId}/logs/stream`);

    sse.addEventListener('log', (e: MessageEvent) => {
      term.writeln(e.data);
    });

    sse.onmessage = (e: MessageEvent) => {
      term.writeln(e.data);
    };

    sse.onerror = () => {
      term.writeln('\x1b[33m[WARN]\x1b[0m Stream disconnected or waiting for output...');
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
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl h-[70vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
          <h3 className="font-medium text-slate-200 flex items-center gap-2">
            <TerminalIcon className="w-4 h-4" /> {module?.name || activeTerminalModuleId} Logs
          </h3>
          <button onClick={() => setActiveTerminal(null)} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 p-2 bg-[#0B0F17]" ref={terminalRef}></div>
      </div>
    </div>
  );
};
