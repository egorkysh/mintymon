'use client';

import { PageHeader } from '@/components/layout/page-header';
import { MetricCard } from '@/components/dashboard/metric-card';
import { SectionGrid } from '@/components/dashboard/section-grid';
import { WidgetSkeleton } from '@/components/dashboard/widget-skeleton';
import { useOverviewStatus } from '@/hooks/useOverviewStatus';
import { formatBytes } from '@/lib/utils';
import type { StatusLevel } from '@/components/dashboard/status-badge';

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}`;
  return `${(ms / 1000).toFixed(2)}`;
}

export default function OverviewPage() {
  const { vercel, axiom, neon } = useOverviewStatus();

  const isLoading = vercel.isLoading || axiom.isLoading || neon.isLoading;

  // Extract values
  const deploymentCount = vercel.data?.data?.deployments?.length ?? 0;
  const successRate = vercel.data?.data?.deployments
    ? (() => {
        const deps = vercel.data.data.deployments as Array<{ state: string }>;
        const completed = deps.filter((d) => d.state === 'READY' || d.state === 'ERROR');
        const ok = completed.filter((d) => d.state === 'READY');
        return completed.length > 0 ? (ok.length / completed.length) * 100 : 100;
      })()
    : 100;

  const p95 = axiom.data?.data?.p95 ?? 0;
  const p50 = axiom.data?.data?.p50 ?? 0;
  const errorRate = axiom.data?.data?.errorRate ?? 0;
  const totalRequests = axiom.data?.data?.totalRequests ?? 0;

  const dbSize = neon.data?.data?.branches?.[0]?.logicalSize ?? 0;

  const latencyStatus: StatusLevel = p95 > 2000 ? 'critical' : p95 > 500 ? 'warning' : 'healthy';
  const errorStatus: StatusLevel = errorRate > 5 ? 'critical' : errorRate > 1 ? 'warning' : 'healthy';
  const deployStatus: StatusLevel = successRate < 80 ? 'critical' : successRate < 95 ? 'warning' : 'healthy';

  return (
    <div>
      <PageHeader
        title="System Overview"
        description="Real-time operational metrics for MintCV"
      />

      {isLoading ? (
        <SectionGrid columns={4}>
          {Array.from({ length: 8 }).map((_, i) => (
            <WidgetSkeleton key={i} />
          ))}
        </SectionGrid>
      ) : (
        <SectionGrid columns={4}>
          <MetricCard
            label="Deployments"
            value={deploymentCount}
            unit="recent"
            status={deployStatus}
            className="animate-fade-up"
            style={{ animationDelay: '0ms' }}
          />
          <MetricCard
            label="Success Rate"
            value={`${successRate.toFixed(1)}%`}
            status={deployStatus}
            className="animate-fade-up"
            style={{ animationDelay: '50ms' }}
          />
          <MetricCard
            label="P95 Latency"
            value={formatMs(p95)}
            unit={p95 < 1000 ? 'ms' : 's'}
            status={latencyStatus}
            className="animate-fade-up"
            style={{ animationDelay: '100ms' }}
          />
          <MetricCard
            label="P50 Latency"
            value={formatMs(p50)}
            unit={p50 < 1000 ? 'ms' : 's'}
            status="healthy"
            className="animate-fade-up"
            style={{ animationDelay: '150ms' }}
          />
          <MetricCard
            label="Error Rate"
            value={`${errorRate.toFixed(2)}%`}
            status={errorStatus}
            className="animate-fade-up"
            style={{ animationDelay: '200ms' }}
          />
          <MetricCard
            label="Total Requests"
            value={totalRequests.toLocaleString()}
            unit="5m window"
            status="healthy"
            className="animate-fade-up"
            style={{ animationDelay: '250ms' }}
          />
          <MetricCard
            label="DB Size"
            value={formatBytes(dbSize)}
            status="healthy"
            className="animate-fade-up"
            style={{ animationDelay: '300ms' }}
          />
          <MetricCard
            label="Endpoints"
            value={neon.data?.data?.endpoints?.length ?? 0}
            unit="active"
            status="healthy"
            className="animate-fade-up"
            style={{ animationDelay: '350ms' }}
          />
        </SectionGrid>
      )}
    </div>
  );
}
