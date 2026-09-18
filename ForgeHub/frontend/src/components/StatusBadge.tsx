import React from 'react';

export interface StatusBadgeProps {
  status: 'installed' | 'available' | 'dev' | 'running' | 'stopped' | 'error' | 'online' | 'offline';
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  switch (status) {
    case 'installed':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          {label || 'Instalado'}
        </span>
      );
    case 'running':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          {label || 'Em execução'}
        </span>
      );
    case 'available':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-forge-surface-2 text-forge-text-secondary border border-forge-border ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-forge-primary"></span>
          {label || 'Disponível'}
        </span>
      );
    case 'dev':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          {label || 'Em desenvolvimento'}
        </span>
      );
    case 'stopped':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-forge-surface-2 text-forge-text-muted border border-forge-border ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-forge-text-muted"></span>
          {label || 'Parado'}
        </span>
      );
    case 'error':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          {label || 'Erro'}
        </span>
      );
    case 'online':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          {label || 'Online'}
        </span>
      );
    case 'offline':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          {label || 'Desconectado'}
        </span>
      );
    default:
      return null;
  }
};
