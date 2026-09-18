import React from 'react';
import { useStore } from '../store/useStore';
import { ViewType } from '../types';
import { 
  LayoutGrid, 
  Layers, 
  ShoppingBag, 
  Cpu, 
  Wifi, 
  Terminal, 
  Settings, 
  LucideIcon
} from 'lucide-react';

interface NavItem {
  id: ViewType;
  label: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const { view, setView, modules, wifiNetworks, telemetry, connected } = useStore();

  const runningCount = modules.filter(m => m.status === 'running').length;
  const wifiCount = wifiNetworks.length;

  const navSections: NavSection[] = [
    {
      title: 'SISTEMA',
      items: [
        { id: 'home', label: 'Início', icon: LayoutGrid },
        { id: 'hardware', label: 'Hardware & Telemetria', icon: Cpu },
        { id: 'logs', label: 'Logs do Sistema', icon: Terminal },
      ],
    },
    {
      title: 'REDE & CONECTIVIDADE',
      items: [
        { 
          id: 'network', 
          label: 'Wi-Fi & Conexões', 
          icon: Wifi, 
          badge: wifiCount > 0 ? `${wifiCount} ${wifiCount === 1 ? 'Rede' : 'Redes'}` : undefined 
        },
      ],
    },
    {
      title: 'APLICAÇÕES',
      items: [
        { 
          id: 'apps', 
          label: 'Aplicações Ativas', 
          icon: Layers, 
          badge: runningCount > 0 ? `${runningCount} Ativa${runningCount > 1 ? 's' : ''}` : undefined,
          badgeColor: runningCount > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : undefined
        },
        { 
          id: 'marketplace', 
          label: 'Marketplace', 
          icon: ShoppingBag, 
          badge: `${modules.length} Apps` 
        },
      ],
    },
    {
      title: 'PREFERÊNCIAS',
      items: [
        { id: 'settings', label: 'Configurações', icon: Settings },
      ],
    },
  ];

  return (
    <aside className="w-60 bg-forge-bg border-r border-forge-border flex flex-col justify-between h-full select-none shrink-0">
      {/* Brand Header */}
      <div>
        <div 
          onClick={() => setView('home')} 
          className="px-5 py-4 flex items-center gap-3 cursor-pointer border-b border-forge-border/60 hover:bg-forge-surface/30 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-forge-surface flex items-center justify-center p-1 border border-forge-border shadow-sm">
            <img 
              src="/logo.png" 
              alt="ForgeOS" 
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo-sm.png';
              }} 
            />
          </div>
          <div>
            <div className="flex items-center gap-1 leading-none">
              <span className="font-bold text-base text-forge-text tracking-tight">Forge</span>
              <span className="font-bold text-base text-forge-primary tracking-tight">OS</span>
            </div>
            <span className="text-[9px] font-mono text-forge-text-muted tracking-widest uppercase">
              MULTIFORGE
            </span>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="p-3 space-y-5 overflow-y-auto max-h-[calc(100vh-170px)] scrollbar-thin">
          {navSections.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-3 text-[10px] font-mono uppercase tracking-wider text-forge-text-muted font-semibold">
                {sec.title}
              </div>
              <div className="space-y-0.5 pt-1">
                {sec.items.map((item) => {
                  const isActive = view === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setView(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-forge-primary/10 text-forge-primary font-semibold shadow-sm'
                          : 'text-forge-text-secondary hover:text-forge-text hover:bg-forge-surface'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-forge-primary' : 'text-forge-text-muted'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                          item.badgeColor || 'bg-forge-surface-2 text-forge-text-muted border border-forge-border'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Device Info Footer */}
      <div className="p-3 border-t border-forge-border/80 bg-forge-surface/40">
        <div 
          onClick={() => setView('hardware')}
          className="p-2.5 rounded-lg bg-forge-surface/60 border border-forge-border hover:border-forge-border-hover cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-forge-text truncate">
              {telemetry.systemInfo?.hostname || 'Dispositivo ForgeOS'}
            </span>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-forge-primary animate-pulse' : 'bg-rose-500'}`} />
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-forge-text-muted">
            <span>{telemetry.systemInfo?.device_model ? 'BTV E10' : '192.168.4.1'}</span>
            <span className="text-forge-primary font-medium">v0.1.0</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
