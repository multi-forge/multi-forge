import { useEffect } from 'react';
import { useStore, initSSETelemetry } from './store/useStore';
import { Header } from './components/Header';
import { TelemetryDashboard } from './components/TelemetryDashboard';
import { StoreView } from './components/StoreView';
import { ModuleManager } from './components/ModuleManager';
import { HardwareWifiView } from './components/HardwareWifiView';
import { TerminalModal } from './components/TerminalModal';
import { PreflightAlert } from './components/PreflightAlert';

function App() {
  const { view, setView, fetchModules, fetchScan } = useStore();

  useEffect(() => {
    initSSETelemetry();
    fetchModules();
    fetchScan();

    const params = new URLSearchParams(window.location.search);
    const v = params.get('view') || window.location.hash.replace('#', '');
    if (v === 'hardware' || v === 'manager' || v === 'store' || v === 'dashboard') {
      setView(v as any);
    }
  }, []);

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
