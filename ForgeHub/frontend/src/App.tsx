import { useEffect, useState } from 'react';
import { useStore, initSSETelemetry } from './store/useStore';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { HomePage } from './components/HomePage';
import { TelemetryDashboard } from './components/TelemetryDashboard';
import { StoreView } from './components/StoreView';
import { ModuleManager } from './components/ModuleManager';
import { HardwareWifiView } from './components/HardwareWifiView';
import { LogsView } from './components/LogsView';
import { SettingsView } from './components/SettingsView';
import { TerminalModal } from './components/TerminalModal';
import { PreflightAlert } from './components/PreflightAlert';
import { 
  LayoutGrid, 
  Layers, 
  ShoppingBag, 
  Cpu, 
  MoreHorizontal,
  Wifi,
  Terminal,
  Settings,
  X
} from 'lucide-react';
import { ViewType } from './types';

function App() {
  const { view, setView, fetchModules } = useStore();
  const [entry, setEntry] = useState<'choice' | 'provision' | 'hub'>('choice');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (entry !== 'hub') return;
    initSSETelemetry();
    fetchModules();

    const params = new URLSearchParams(window.location.search);
    const v = params.get('view') || window.location.hash.replace('#', '');
    const validViews: ViewType[] = ['home', 'apps', 'marketplace', 'hardware', 'network', 'logs', 'settings'];
    if (validViews.includes(v as ViewType)) {
      setView(v as ViewType);
    } else if (v === 'dashboard') {
      setView('home');
    } else if (v === 'store') {
      setView('marketplace');
    } else if (v === 'manager') {
      setView('apps');
    }
  }, [entry, fetchModules, setView]);

  // Provisioning Entry Experience
  if (entry !== 'hub') {
    return (
      <div className="min-h-screen w-full flex flex-col bg-forge-bg text-forge-text font-sans">
        <header className="h-14 bg-forge-surface border-b border-forge-border px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <img 
              src="/logo.png" 
              alt="ForgeOS" 
              className="w-8 h-8 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo-sm.png';
              }} 
            />
            <span className="text-lg font-bold text-forge-text tracking-tight">
              Forge<span className="text-forge-primary">OS</span>
            </span>
          </div>
          {entry === 'provision' && (
            <button 
              className="text-xs font-medium text-forge-text-secondary hover:text-forge-text px-3 py-1.5 rounded-lg hover:bg-forge-surface-2 transition-colors" 
              onClick={() => setEntry('choice')}
            >
              Voltar
            </button>
          )}
        </header>

        {entry === 'choice' ? (
          <main 
            style={{ minHeight: 'calc(100dvh - 56px)', display: 'grid', placeItems: 'center' }} 
            className="p-4 sm:p-6 md:p-8"
          >
            <section className="w-full max-w-lg bg-forge-surface border border-forge-border rounded-2xl p-6 sm:p-8 shadow-xl space-y-6" aria-labelledby="provision-title">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-forge-primary">
                  Bem-vindo ao ForgeOS
                </span>
                <h1 id="provision-title" className="text-xl sm:text-2xl font-bold text-forge-text mt-2 mb-2">
                  Deseja provisionar esta TV box?
                </h1>
                <p className="text-forge-text-secondary text-xs sm:text-sm leading-relaxed">
                  Conecte a TV box à sua rede Wi-Fi agora ou continue com a conexão atual. Você poderá configurar novas redes a qualquer momento no painel.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setEntry('provision')} 
                  className="w-full bg-forge-primary hover:bg-forge-primary-hover text-forge-bg py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                >
                  Provisionar Wi-Fi da TV box
                </button>
                <button 
                  onClick={() => setEntry('hub')} 
                  className="w-full bg-forge-surface-2 hover:bg-forge-surface-3 border border-forge-border text-forge-text py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Continuar sem provisionar
                </button>
              </div>
            </section>
          </main>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <HardwareWifiView />
            </div>
            <div className="p-3 text-center border-t border-forge-border bg-forge-surface shrink-0">
              <button 
                onClick={() => setEntry('hub')} 
                className="text-xs font-semibold text-forge-primary hover:underline"
              >
                Continuar para o ForgeOS Hub →
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ForgeOS Hub Experience (Desktop with Sidebar + Mobile with Bottom Nav & Drawer)
  return (
    <div className="h-full w-full flex bg-forge-bg text-forge-text font-sans overflow-hidden">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar />
      </div>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopBar 
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} 
          mobileMenuOpen={mobileMenuOpen} 
        />
        <PreflightAlert />
        
        <main className="flex-1 overflow-hidden relative pb-14 md:pb-0">
          {view === 'home' && <HomePage />}
          {view === 'apps' && <ModuleManager />}
          {view === 'marketplace' && <StoreView />}
          {view === 'hardware' && <TelemetryDashboard />}
          {view === 'network' && <HardwareWifiView />}
          {view === 'logs' && <LogsView />}
          {view === 'settings' && <SettingsView />}
        </main>

        {/* Mobile Bottom Navigation Bar (<768px) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-forge-surface/95 backdrop-blur-md border-t border-forge-border flex items-center justify-around z-30 px-2">
          <button
            onClick={() => { setView('home'); setMobileMenuOpen(false); }}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition-colors ${
              view === 'home' ? 'text-forge-primary font-bold' : 'text-forge-text-muted hover:text-forge-text'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="text-[10px]">Início</span>
          </button>

          <button
            onClick={() => { setView('apps'); setMobileMenuOpen(false); }}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition-colors ${
              view === 'apps' ? 'text-forge-primary font-bold' : 'text-forge-text-muted hover:text-forge-text'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="text-[10px]">Aplicações</span>
          </button>

          <button
            onClick={() => { setView('marketplace'); setMobileMenuOpen(false); }}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition-colors ${
              view === 'marketplace' ? 'text-forge-primary font-bold' : 'text-forge-text-muted hover:text-forge-text'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="text-[10px]">Marketplace</span>
          </button>

          <button
            onClick={() => { setView('hardware'); setMobileMenuOpen(false); }}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition-colors ${
              view === 'hardware' ? 'text-forge-primary font-bold' : 'text-forge-text-muted hover:text-forge-text'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span className="text-[10px]">Hardware</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition-colors ${
              mobileMenuOpen ? 'text-forge-primary font-bold' : 'text-forge-text-muted hover:text-forge-text'
            }`}
          >
            <MoreHorizontal className="w-4 h-4" />
            <span className="text-[10px]">Mais</span>
          </button>
        </nav>

        {/* Mobile "Mais" Drawer Sheet */}
        {mobileMenuOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-xs flex flex-col justify-end"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div 
              className="bg-forge-surface border-t border-forge-border rounded-t-2xl p-4 space-y-2 mb-14"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-forge-border">
                <span className="text-xs font-semibold text-forge-text-muted uppercase">
                  Menu Rápido
                </span>
                <button onClick={() => setMobileMenuOpen(false)} className="text-forge-text-muted hover:text-forge-text">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => { setView('network'); setMobileMenuOpen(false); }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-forge-surface-2 border border-forge-border text-xs font-medium text-forge-text hover:border-forge-primary"
                >
                  <Wifi className="w-5 h-5 text-forge-primary" />
                  <span>Wi-Fi & Rede</span>
                </button>

                <button
                  onClick={() => { setView('logs'); setMobileMenuOpen(false); }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-forge-surface-2 border border-forge-border text-xs font-medium text-forge-text hover:border-forge-primary"
                >
                  <Terminal className="w-5 h-5 text-forge-accent" />
                  <span>Logs do SO</span>
                </button>

                <button
                  onClick={() => { setView('settings'); setMobileMenuOpen(false); }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-forge-surface-2 border border-forge-border text-xs font-medium text-forge-text hover:border-forge-primary"
                >
                  <Settings className="w-5 h-5 text-amber-400" />
                  <span>Configurações</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <TerminalModal />
      </div>
    </div>
  );
}

export default App;
