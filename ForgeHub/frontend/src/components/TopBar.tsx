import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  Search, 
  RotateCcw, 
  Sun, 
  Moon, 
  Menu, 
  X,
  CheckCircle2
} from 'lucide-react';

interface TopBarProps {
  onMobileMenuToggle?: () => void;
  mobileMenuOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onMobileMenuToggle, mobileMenuOpen }) => {
  const { theme, toggleTheme, resetWifi, setView } = useStore();
  const [resetting, setResetting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  // Keyboard shortcut Ctrl+K for search focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('topbar-search-input');
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleResetAP = async () => {
    if (!window.confirm('Deseja realmente reiniciar o ponto de acesso Wi-Fi (Modo AP)?')) {
      return;
    }
    setResetting(true);
    try {
      await resetWifi();
      setResetFeedback('Comando de reinício enviado!');
      setTimeout(() => setResetFeedback(null), 3000);
    } catch {
      setResetFeedback('Falha ao reiniciar AP');
      setTimeout(() => setResetFeedback(null), 3000);
    } finally {
      setResetting(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    // Default to marketplace or apps if searching
    setView('marketplace');
  };

  return (
    <header className="h-[52px] bg-forge-bg/95 backdrop-blur-sm border-b border-forge-border px-4 sm:px-6 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left: Mobile hamburger & Logo on mobile, Search bar on desktop */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {/* Mobile menu trigger */}
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-1.5 rounded-lg text-forge-text-secondary hover:text-forge-text hover:bg-forge-surface transition-colors"
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Mobile Brand */}
        <div className="flex md:hidden items-center gap-2" onClick={() => setView('home')}>
          <img src="/logo.png" alt="ForgeOS" className="w-6 h-6 object-contain" />
          <span className="font-bold text-sm text-forge-text tracking-tight">Forge<span className="text-forge-primary">OS</span></span>
        </div>

        {/* Desktop Search Bar */}
        <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center w-full relative">
          <Search className="w-4 h-4 absolute left-3 text-forge-text-muted" />
          <input
            id="topbar-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar serviços, logs, rede ou comandos..."
            className="w-full bg-forge-surface border border-forge-border rounded-lg pl-9 pr-14 py-1.5 text-xs text-forge-text placeholder-forge-text-muted focus:outline-none focus:border-forge-primary transition-colors"
          />
          <div className="absolute right-2.5 flex items-center gap-0.5 pointer-events-none">
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-forge-surface-2 border border-forge-border rounded text-forge-text-muted">
              Ctrl+K
            </kbd>
          </div>
        </form>
      </div>

      {/* Right Actions: AP Badge, Reiniciar AP, Theme Toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* AP IP Status Pill */}
        <div 
          onClick={() => setView('network')}
          className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-forge-surface border border-forge-border text-[11px] font-mono cursor-pointer hover:border-forge-border-hover transition-colors"
          title="Ver detalhes de rede"
        >
          <span className="w-2 h-2 rounded-full bg-forge-primary animate-pulse" />
          <span className="text-forge-text-secondary">AP: <strong className="text-forge-text">192.168.4.1</strong></span>
        </div>

        {/* Reiniciar AP Button */}
        <button
          onClick={handleResetAP}
          disabled={resetting}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-forge-surface hover:bg-forge-surface-2 border border-forge-border text-xs font-medium text-forge-text-secondary hover:text-forge-text transition-colors"
          title="Reiniciar Modo Ponto de Acesso Wi-Fi"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin text-forge-primary' : ''}`} />
          <span className="hidden sm:inline">Reiniciar AP</span>
        </button>

        {/* Feedback tooltip if any */}
        {resetFeedback && (
          <span className="text-[11px] font-mono text-forge-primary flex items-center gap-1 animate-fade-in">
            <CheckCircle2 className="w-3 h-3" /> {resetFeedback}
          </span>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg bg-forge-surface hover:bg-forge-surface-2 border border-forge-border text-forge-text-secondary hover:text-forge-text transition-colors"
          title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-cyan-500" />
          )}
        </button>
      </div>
    </header>
  );
};
