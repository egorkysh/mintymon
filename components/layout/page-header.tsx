import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6', className)}>
      <div>
        <h2 className="text-lg font-semibold text-text-primary tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-text-tertiary mt-0.5">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 self-start sm:self-auto">{children}</div>}
    </div>
  );
}
