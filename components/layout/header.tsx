'use client';

import { cn } from '@/lib/utils';
import {
  useTimeRange,
  type TimeRangePreset,
} from '@/components/providers/time-range-provider';
import { LogOut, Clock } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { authClient } from '@/lib/auth-client';

const presets: { value: TimeRangePreset; label: string }[] = [
  { value: '1h', label: '1H' },
  { value: '6h', label: '6H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { preset, setPreset } = useTimeRange();

  const handleLogout = async () => {
    await authClient.signOut();
    window.location.href = '/';
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-6 border-b border-border bg-bg/80 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {title && (
          <h1 className="text-sm font-semibold text-text-primary tracking-tight">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Time range selector */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
          <Clock className="h-3.5 w-3.5 text-text-tertiary ml-2 mr-1" />
          {presets.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={cn(
                'px-2.5 py-1 text-[11px] font-semibold tracking-wide rounded-md',
                'transition-all duration-150',
                preset === p.value
                  ? 'bg-accent-bg text-accent'
                  : 'text-text-tertiary hover:text-text-secondary',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 px-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-healthy opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-healthy" />
          </span>
          <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
            Live
          </span>
        </div>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-surface-raised transition-colors"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
