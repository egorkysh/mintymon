'use client';

import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface WidgetSkeletonProps {
  className?: string;
  lines?: number;
}

const LINE_WIDTHS = ['75%', '85%', '65%', '90%', '70%', '80%', '60%', '88%'];

export function WidgetSkeleton({ className, lines = 3 }: WidgetSkeletonProps) {
  const extraLines = useMemo(() => Math.max(0, lines - 2), [lines]);

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface p-5 space-y-3',
        className,
      )}
    >
      <div className="h-3 w-24 rounded bg-surface-raised animate-pulse" />
      <div className="h-7 w-20 rounded bg-surface-raised animate-pulse" />
      {Array.from({ length: extraLines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded bg-surface-raised animate-pulse"
          style={{ width: LINE_WIDTHS[i % LINE_WIDTHS.length] }}
        />
      ))}
    </div>
  );
}
