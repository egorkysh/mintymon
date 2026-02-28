'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { QueryProvider } from '@/components/providers/query-provider';
import { TimeRangeProvider } from '@/components/providers/time-range-provider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <TimeRangeProvider>
        <div className="flex min-h-screen noise-bg">
          <Sidebar />
          {/* Main content area — offset by sidebar width via CSS */}
          <div className="flex-1 ml-16 xl:ml-56 transition-all duration-300">
            <Header />
            <main className="relative z-10 p-6">
              {children}
            </main>
          </div>
        </div>
      </TimeRangeProvider>
    </QueryProvider>
  );
}
