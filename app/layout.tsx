import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mintymon — Monitoring Dashboard',
  description: 'Operational monitoring dashboard for MintCV',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
