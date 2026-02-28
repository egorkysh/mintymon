'use client';

import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { usePollingConfig } from '@/hooks/usePollingConfig';
import { useQuery } from '@tanstack/react-query';
import type { PollingKey } from '@/lib/polling';

const pollingLabels: Record<PollingKey, string> = {
  deployments: 'Deployments',
  latency: 'Latency Charts',
  database: 'Database Stats',
  alerts: 'Alerts',
  overview: 'Overview Cards',
};

const intervalOptions = [
  { value: 10_000, label: '10s' },
  { value: 30_000, label: '30s' },
  { value: 60_000, label: '1m' },
  { value: 120_000, label: '2m' },
  { value: 300_000, label: '5m' },
];

export default function SettingsPage() {
  const { intervals, update } = usePollingConfig();

  const providers = useQuery({
    queryKey: ['provider-configs'],
    queryFn: async () => {
      // Fetch all provider snapshots to get their status
      const [vercel, neon, axiom] = await Promise.all([
        fetch('/api/metrics/vercel').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/metrics/neon').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/metrics/axiom').then((r) => (r.ok ? r.json() : null)),
      ]);
      return { vercel, neon, axiom };
    },
    refetchInterval: 60_000,
  });

  const providerList = [
    { id: 'vercel', name: 'Vercel Deployments', hasData: !!providers.data?.vercel },
    { id: 'neon', name: 'Neon Database', hasData: !!providers.data?.neon },
    { id: 'axiom', name: 'Axiom Latency', hasData: !!providers.data?.axiom },
  ];

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Provider status and polling configuration"
      />

      <div className="space-y-6">
        {/* Provider Status */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h3 className="text-sm font-medium text-text-primary">Data Providers</h3>
          </div>
          <div className="divide-y divide-border-subtle">
            {providerList.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-text-primary">{p.name}</span>
                  <span className="text-[11px] font-mono text-text-tertiary">{p.id}</span>
                </div>
                <StatusBadge
                  status={p.hasData ? 'healthy' : 'unknown'}
                  label={p.hasData ? 'Connected' : 'No data'}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Polling Intervals */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h3 className="text-sm font-medium text-text-primary">Dashboard Polling Intervals</h3>
            <p className="text-[11px] text-text-tertiary mt-0.5">
              How often the dashboard fetches fresh data (saved to browser)
            </p>
          </div>
          <div className="divide-y divide-border-subtle">
            {(Object.keys(pollingLabels) as PollingKey[]).map((key) => (
              <div key={key} className="flex items-center justify-between px-5 py-4">
                <span className="text-sm text-text-primary">{pollingLabels[key]}</span>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-bg p-0.5">
                  {intervalOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update(key, opt.value)}
                      className={`px-2.5 py-1 text-[11px] font-semibold tracking-wide rounded-md transition-all duration-150 ${
                        intervals[key] === opt.value
                          ? 'bg-accent-bg text-accent'
                          : 'text-text-tertiary hover:text-text-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
