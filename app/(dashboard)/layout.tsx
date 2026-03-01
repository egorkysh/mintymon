import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { LoginForm } from '@/components/login-form';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { QueryProvider } from '@/components/providers/query-provider';
import { TimeRangeProvider } from '@/components/providers/time-range-provider';
import { SidebarProvider } from '@/components/providers/sidebar-provider';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return <LoginForm />;
  }

  return (
    <QueryProvider>
      <TimeRangeProvider>
        <SidebarProvider>
          <div className="flex min-h-screen noise-bg overflow-x-hidden">
            <Sidebar />
            {/* Main content area — offset by sidebar width via CSS */}
            <div className="flex-1 min-w-0 ml-0 md:ml-16 xl:ml-56 transition-all duration-300">
              <Header />
              <main className="relative z-10 p-4 md:p-6">
                {children}
              </main>
            </div>
          </div>
        </SidebarProvider>
      </TimeRangeProvider>
    </QueryProvider>
  );
}
