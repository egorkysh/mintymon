'use client';

import { cn } from '@/lib/utils';
import { WidgetSkeleton } from './widget-skeleton';

interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyMessage = 'No data',
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return <WidgetSkeleton className={className} lines={6} />;
  }

  return (
    <div className={cn('rounded-lg border border-border bg-surface overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 md:px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-text-tertiary',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-text-tertiary"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={i}
                  className="transition-colors hover:bg-surface-raised/50"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-3 md:px-4 py-3', col.className)}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
