import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  unit?: string;
  badge?: React.ReactNode;
  progressPct?: number;
  progressColor?: string;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  badge,
  progressPct,
  progressColor = 'bg-forge-primary',
  subtitle,
  icon: Icon,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`forge-card p-4 flex flex-col justify-between transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-forge-border-hover' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-forge-primary" />}
          <span className="text-[11px] font-semibold tracking-wider uppercase text-forge-text-muted">
            {title}
          </span>
        </div>
        {badge && <div>{badge}</div>}
      </div>

      <div className="my-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold text-forge-text tracking-tight">{value}</span>
          {unit && <span className="text-xs font-mono text-forge-text-secondary">{unit}</span>}
        </div>
      </div>

      {progressPct !== undefined && (
        <div className="w-full bg-forge-surface-3 h-1.5 rounded-full my-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>
      )}

      {subtitle && (
        <div className="text-[11px] text-forge-text-secondary font-mono leading-tight mt-1 truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
};
