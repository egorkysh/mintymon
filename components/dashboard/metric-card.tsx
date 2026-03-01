'use client';

import { cn } from '@/lib/utils';
import { Sparkline } from './sparkline';
import type { StatusLevel } from './status-badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  sparklineData?: number[];
  sparklineColor?: string;
  status?: StatusLevel;
  className?: string;
  style?: React.CSSProperties;
}

const glowClass: Record<StatusLevel, string> = {
  healthy: 'glow-healthy',
  warning: 'glow-warning',
  critical: 'glow-critical',
  unknown: '',
};

const statusDotClass: Record<StatusLevel, string> = {
  healthy: 'bg-healthy',
  warning: 'bg-warning',
  critical: 'bg-critical',
  unknown: 'bg-text-tertiary',
};

export function MetricCard({
  label,
  value,
  unit,
  change,
  sparklineData,
  sparklineColor,
  status = 'healthy',
  className,
  style,
}: MetricCardProps) {
  const changeIcon =
    change == null ? null :
    change > 0 ? <TrendingUp className="h-3 w-3" /> :
    change < 0 ? <TrendingDown className="h-3 w-3" /> :
    <Minus className="h-3 w-3" />;

  const changeColor =
    change == null ? '' :
    change > 0 ? 'text-healthy' :
    change < 0 ? 'text-critical' :
    'text-text-tertiary';

  return (
    <div
      className={cn(
        'relative rounded-lg border border-border bg-surface p-4 md:p-5',
        'transition-all duration-300',
        'hover:border-border-subtle hover:bg-surface/80',
        glowClass[status],
        className,
      )}
      style={style}
    >
      {/* Header: label + status dot */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
          {label}
        </span>
        <span
          className={cn(
            'h-2 w-2 rounded-full shrink-0',
            statusDotClass[status],
            status !== 'unknown' && 'animate-status-pulse',
          )}
        />
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight font-mono text-text-primary">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-medium text-text-tertiary uppercase">
            {unit}
          </span>
        )}
      </div>

      {/* Change badge + sparkline */}
      <div className="flex items-end justify-between mt-3 gap-3">
        {change != null ? (
          <span className={cn('inline-flex items-center gap-1 text-xs font-medium font-mono', changeColor)}>
            {changeIcon}
            {change > 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        ) : (
          <span />
        )}
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline
            data={sparklineData}
            color={sparklineColor ?? 'var(--mn-chart-1)'}
            height={28}
            className="w-24 opacity-80"
          />
        )}
      </div>
    </div>
  );
}
