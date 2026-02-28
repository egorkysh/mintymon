'use client';

import { PageHeader } from '@/components/layout/page-header';
import { SectionGrid } from '@/components/dashboard/section-grid';
import { MetricCard } from '@/components/dashboard/metric-card';
import { ChartPanel } from '@/components/dashboard/chart-panel';
import { DataTable } from '@/components/dashboard/data-table';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { useDatabaseStats } from '@/hooks/useDatabaseStats';
import { useLatencyMetrics } from '@/hooks/useLatencyMetrics';
import { formatBytes } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import type { StatusLevel } from '@/components/dashboard/status-badge';

interface Branch {
  id: string;
  name: string;
  logicalSize: number;
  writtenDataBytes: number;
  computeTimeSeconds: number;
  currentState: string;
}

interface Endpoint {
  id: string;
  type: string;
  currentState: string;
  host: string;
  autoscalingLimitMinCu: number;
  autoscalingLimitMaxCu: number;
}

export default function DatabasePage() {
  const { data, isLoading } = useDatabaseStats();
  const sizeTimeseries = useLatencyMetrics('neon.db.size_bytes');

  const branches: Branch[] = data?.data?.branches ?? [];
  const endpoints: Endpoint[] = data?.data?.endpoints ?? [];
  const mainBranch = branches[0];

  const sizeChart = (sizeTimeseries.data?.data ?? []).map((d: { timestamp: string; value: number }) => ({
    time: d.timestamp,
    size: d.value,
  }));

  const endpointColumns = [
    {
      key: 'state',
      header: 'Status',
      className: 'w-24',
      render: (e: Endpoint) => {
        const status: StatusLevel = e.currentState === 'active' ? 'healthy' : e.currentState === 'idle' ? 'unknown' : 'warning';
        return <StatusBadge status={status} label={e.currentState} />;
      },
    },
    {
      key: 'type',
      header: 'Type',
      className: 'w-24',
      render: (e: Endpoint) => (
        <span className="text-xs font-mono text-text-secondary">{e.type}</span>
      ),
    },
    {
      key: 'host',
      header: 'Host',
      render: (e: Endpoint) => (
        <span className="text-xs font-mono text-text-secondary truncate block max-w-xs">{e.host}</span>
      ),
    },
    {
      key: 'compute',
      header: 'Compute',
      className: 'w-28',
      render: (e: Endpoint) => (
        <span className="text-xs font-mono text-text-secondary">
          {e.autoscalingLimitMinCu} - {e.autoscalingLimitMaxCu} CU
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Database"
        description="Neon PostgreSQL metrics and status"
      />

      <SectionGrid columns={3} className="mb-6">
        <MetricCard
          label="Database Size"
          value={formatBytes(mainBranch?.logicalSize ?? 0)}
          status="healthy"
          className="animate-fade-up"
          style={{ animationDelay: '0ms' }}
        />
        <MetricCard
          label="Written Data"
          value={formatBytes(mainBranch?.writtenDataBytes ?? 0)}
          status="healthy"
          className="animate-fade-up"
          style={{ animationDelay: '50ms' }}
        />
        <MetricCard
          label="Compute Time"
          value={`${(mainBranch?.computeTimeSeconds ?? 0).toFixed(1)}`}
          unit="seconds"
          status="healthy"
          className="animate-fade-up"
          style={{ animationDelay: '100ms' }}
        />
      </SectionGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartPanel
          title="Storage Over Time"
          subtitle="Database logical size"
          isLoading={sizeTimeseries.isLoading}
          isEmpty={sizeChart.length === 0}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sizeChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--mn-border)" />
                <XAxis
                  dataKey="time"
                  tickFormatter={(t) => format(new Date(t), 'HH:mm')}
                  stroke="var(--mn-text-tertiary)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--mn-text-tertiary)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatBytes(v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--mn-surface)',
                    borderColor: 'var(--mn-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatBytes(v), 'Size']}
                  labelFormatter={(t) => format(new Date(t as string), 'MMM d, HH:mm')}
                />
                <Bar dataKey="size" fill="var(--mn-chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Endpoints" isLoading={isLoading} isEmpty={endpoints.length === 0}>
          <DataTable columns={endpointColumns} data={endpoints} />
        </ChartPanel>
      </div>
    </div>
  );
}
