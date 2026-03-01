'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

interface SidebarContextValue {
  isMobile: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpenState] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const setMobileOpen = useCallback((open: boolean) => {
    setMobileOpenState(open);
    document.body.style.overflow = open ? 'hidden' : '';
  }, []);

  useEffect(() => {
    const mqMobile = window.matchMedia('(max-width: 767px)');
    const mqDesktop = window.matchMedia('(min-width: 1280px)');

    const update = () => {
      const mobile = mqMobile.matches;
      setIsMobile(mobile);
      if (mobile) {
        setMobileOpenState(false);
        document.body.style.overflow = '';
      }
      setCollapsed(!mqDesktop.matches && !mobile);
    };

    update();
    mqMobile.addEventListener('change', update);
    mqDesktop.addEventListener('change', update);
    return () => {
      mqMobile.removeEventListener('change', update);
      mqDesktop.removeEventListener('change', update);
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <SidebarContext.Provider
      value={{ isMobile, mobileOpen, setMobileOpen, collapsed, setCollapsed }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
