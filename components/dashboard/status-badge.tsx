'use client';

import { cn } from '@/lib/utils';

export type StatusLevel = 'healthy' | 'warning' | 'critical' | 'unknown';

const config: Record<StatusLevel, { label: string; dotClass: string; bgClass: string; textClass: string }> = {
  healthy: {
    label: 'Healthy',
    dotClass: 'bg-healthy',
    bgClass: 'bg-healthy-bg',
    textClass: 'text-healthy',
  },
  warning: {
    label: 'Warning',
    dotClass: 'bg-warning',
    bgClass: 'bg-warning-bg',
    textClass: 'text-warning',
  },
  critical: {
    label: 'Critical',
    dotClass: 'bg-critical',
    bgClass: 'bg-critical-bg',
    textClass: 'text-critical',
  },
  unknown: {
    label: 'Unknown',
    dotClass: 'bg-text-tertiary',
    bgClass: 'bg-surface-raised',
    textClass: 'text-text-tertiary',
  },
};

interface StatusBadgeProps {
  status: StatusLevel;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, label, className, size = 'sm' }: StatusBadgeProps) {
  const c = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        c.bgClass,
        c.textClass,
        size === 'sm' ? 'px-2 py-0.5 text-[11px] tracking-wide uppercase' : 'px-2.5 py-1 text-xs',
        className,
      )}
    >
      <span
        className={cn(
          'rounded-full shrink-0',
          c.dotClass,
          size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
          status !== 'unknown' && 'animate-status-pulse',
        )}
      />
      {label ?? c.label}
    </span>
  );
}
