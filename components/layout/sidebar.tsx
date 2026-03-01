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
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import { useSidebar } from '@/components/providers/sidebar-provider';

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
  const { isMobile, mobileOpen, setMobileOpen, collapsed, setCollapsed } = useSidebar();

  // Close drawer on route change
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [pathname, isMobile, setMobileOpen]);

  // Mobile: hidden by default, slide-in drawer
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}
        {/* Drawer */}
        <aside
          className={cn(
            'fixed left-0 top-0 h-screen z-50 flex flex-col w-56',
            'bg-sidebar-bg border-r border-sidebar-border',
            'transition-transform duration-300 ease-in-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {/* Logo + close */}
          <div className="flex items-center justify-between border-b border-sidebar-border px-4 h-14 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-accent-bg">
                <Monitor className="w-4 h-4 text-accent" />
                <div className="absolute inset-0 rounded-lg bg-accent/10 blur-sm" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-text-primary tracking-tight leading-none">
                  mintymon
                </span>
                <span className="text-[10px] text-text-tertiary tracking-wider uppercase mt-0.5">
                  monitoring
                </span>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1 rounded-md text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
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
                    isActive
                      ? 'bg-sidebar-active text-accent'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised/50',
                  )}
                >
                  <Icon className="shrink-0 h-4 w-4" />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent animate-status-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>
      </>
    );
  }

  // Tablet / Desktop
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
