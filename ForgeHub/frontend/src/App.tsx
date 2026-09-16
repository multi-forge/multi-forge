import { useEffect, useState } from 'react';
import { useStore, initSSETelemetry } from './store/useStore';
import { Header } from './components/Header';
import { TelemetryDashboard } from './components/TelemetryDashboard';
import { StoreView } from './components/StoreView';
import { ModuleManager } from './components/ModuleManager';
import { HardwareWifiView } from './components/HardwareWifiView';
import { TerminalModal } from './components/TerminalModal';
import { PreflightAlert } from './components/PreflightAlert';

function App() {
  const { view, setView, fetchModules } = useStore();

  const [entry, setEntry] = useState<'choice' | 'provision' | 'hub'>('choice');

  useEffect(() => {
    if (entry !== 'hub') return;
    initSSETelemetry();
    fetchModules();

    const params = new URLSearchParams(window.location.search);
    const v = params.get('view') || window.location.hash.replace('#', '');
    if (v === 'hardware' || v === 'manager' || v === 'store' || v === 'dashboard') {
      setView(v as any);
    }
  }, [entry]);

  if (entry !== 'hub') return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-200 font-sans overflow-y-auto">
      <header className="bg-slate-900 border-b border-slate-800 p-4 flex items-center gap-3">
        <img src="/logo.png" alt="ForgeOS" className="w-8 h-8 object-contain" />
        <span className="text-xl font-bold text-white">Forge<span className="text-cyan-400">OS</span></span>
        {entry === 'provision' && <button className="ml-auto text-sm text-slate-300 hover:text-white" onClick={() => setEntry('choice')}>Voltar</button>}
      </header>
      {entry === 'choice' ? (
        <main className="flex-1 flex items-center justify-center p-4 md:p-8">
          <section className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl p-6 md:p-8 shadow-lg" aria-labelledby="provision-title">
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">Bem-vindo ao ForgeOS</span>
            <h1 id="provision-title" className="text-2xl md:text-3xl font-semibold text-slate-100 mt-3 mb-3">Deseja provisionar esta TV box?</h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">Conecte a TV box à sua rede Wi-Fi agora ou continue com a conexão atual. Você pode configurar a rede depois em Hardware.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => setEntry('provision')} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg text-sm font-medium transition-colors">Provisionar TV box</button>
              <button onClick={() => setEntry('hub')} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 py-3 rounded-lg text-sm font-medium transition-colors">Continuar sem provisionar</button>
            </div>
          </section>
        </main>
      ) : (
        <>
          <div className="flex-1 min-h-0"><HardwareWifiView /></div>
          <div className="p-4 text-center border-t border-slate-800"><button onClick={() => setEntry('hub')} className="text-sm text-cyan-400 hover:text-cyan-300">Continuar para o Hub</button></div>
        </>
      )}
    </div>
  );

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-200 font-sans">
      <Header />
      <PreflightAlert />
      
      <main className="flex-1 overflow-hidden relative">
        {view === 'dashboard' && <TelemetryDashboard />}
        {view === 'store' && <StoreView />}
        {view === 'manager' && <ModuleManager />}
        {view === 'hardware' && <HardwareWifiView />}
      </main>

      <TerminalModal />
    </div>
  );
}

export default App;
