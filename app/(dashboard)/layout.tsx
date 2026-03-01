import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { LoginForm } from '@/components/login-form';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { QueryProvider } from '@/components/providers/query-provider';
import { TimeRangeProvider } from '@/components/providers/time-range-provider';

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
