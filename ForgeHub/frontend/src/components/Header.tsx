import React from 'react';
import { useStore } from '../store/useStore';
import { Activity, Wifi, Box, Terminal, Menu } from 'lucide-react';

export const Header: React.FC = () => {
  const { connected, telemetry, view, setView } = useStore();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const navItems = [
    { id: 'dashboard', icon: Activity, label: 'Dashboard' },
    { id: 'store', icon: Box, label: 'Store' },
    { id: 'manager', icon: Terminal, label: 'Modules' },
    { id: 'hardware', icon: Wifi, label: 'Hardware' },
  ] as const;

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-300 p-4">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
          <img
            src="/logo.png"
            alt="Forge Logo"
            width={32}
            height={32}
            className="w-8 h-8 object-contain drop-shadow shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/logo-sm.png';
            }}
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-xl font-bold text-white tracking-tight">Forge</span>
              <span className="text-xl font-bold text-cyan-400 tracking-tight">Hub</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">ForgeOS Enterprise</span>
          </div>
        </div>

        {/* Desktop / Tablet Nav */}
        <nav className="hidden sm:flex items-center gap-2 md:gap-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                view === item.id ? 'bg-slate-800 text-white shadow-sm' : 'hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-xs text-right">
            <span className="font-mono text-slate-400">CPU: {telemetry.cpu.toFixed(0)}%</span>
            <span className="font-mono text-slate-400">RAM: {(telemetry.ram / 1024).toFixed(1)}GB</span>
          </div>
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} title={connected ? 'Connected' : 'Disconnected'} />
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {menuOpen && (
        <nav className="md:hidden mt-4 flex flex-col gap-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setView(item.id); setMenuOpen(false); }}
              className={`flex items-center gap-3 p-3 rounded-md w-full text-left ${
                view === item.id ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </header>
  );
};
