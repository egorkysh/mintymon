import { cn } from '@/lib/utils';
import { WidgetSkeleton } from './widget-skeleton';
import type { ReactNode } from 'react';

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
  headerRight?: ReactNode;
}

export function ChartPanel({
  title,
  subtitle,
  children,
  isLoading,
  isEmpty,
  emptyMessage = 'No data available',
  className,
  headerRight,
}: ChartPanelProps) {
  if (isLoading) {
    return <WidgetSkeleton className={className} lines={5} />;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface',
        className,
      )}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
        <div>
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-text-tertiary mt-0.5">{subtitle}</p>
          )}
        </div>
        {headerRight}
      </div>
      <div className="p-5">
        {isEmpty ? (
          <div className="flex items-center justify-center h-40 text-sm text-text-tertiary">
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
