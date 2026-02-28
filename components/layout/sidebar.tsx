'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Rocket,
  Activity,
  Database,
  Bell,
  Settings,
  Monitor,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/deployments', label: 'Deployments', icon: Rocket },
  { href: '/performance', label: 'Performance', icon: Activity },
  { href: '/database', label: 'Database', icon: Database },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Auto-collapse below 1280px
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1279px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setCollapsed(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen z-40 flex flex-col',
        'bg-sidebar-bg border-r border-sidebar-border',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      {/* Logo / Brand */}
      <div className={cn(
        'flex items-center gap-2.5 border-b border-sidebar-border px-4 h-14 shrink-0',
        collapsed && 'justify-center px-0',
      )}>
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-accent-bg">
          <Monitor className="w-4 h-4 text-accent" />
          {/* Ambient glow behind logo */}
          <div className="absolute inset-0 rounded-lg bg-accent/10 blur-sm" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-text-primary tracking-tight leading-none">
              mintymon
            </span>
            <span className="text-[10px] text-text-tertiary tracking-wider uppercase mt-0.5">
              monitoring
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                'transition-all duration-150',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-sidebar-active text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised/50',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
              {!collapsed && <span>{item.label}</span>}
              {/* Active indicator line */}
              {isActive && !collapsed && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent animate-status-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex items-center justify-center w-full rounded-md py-2',
            'text-text-tertiary hover:text-text-secondary hover:bg-surface-raised/50',
            'transition-colors duration-150',
          )}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
