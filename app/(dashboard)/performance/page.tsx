'use client';

import { PageHeader } from '@/components/layout/page-header';
import { ChartPanel } from '@/components/dashboard/chart-panel';
import { SectionGrid } from '@/components/dashboard/section-grid';
import { MetricCard } from '@/components/dashboard/metric-card';
import { useLatencyMetrics } from '@/hooks/useLatencyMetrics';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

interface MetricPoint {
  timestamp: string;
  value: number;
}

function mergeTimeseries(
  p50Data: MetricPoint[],
  p95Data: MetricPoint[],
  p99Data: MetricPoint[]
) {
  const map = new Map<string, { time: string; p50?: number; p95?: number; p99?: number }>();

  for (const d of p50Data) {
    const key = d.timestamp;
    const entry = map.get(key) ?? { time: key };
    entry.p50 = d.value;
    map.set(key, entry);
  }
  for (const d of p95Data) {
    const key = d.timestamp;
    const entry = map.get(key) ?? { time: key };
    entry.p95 = d.value;
    map.set(key, entry);
  }
  for (const d of p99Data) {
    const key = d.timestamp;
    const entry = map.get(key) ?? { time: key };
    entry.p99 = d.value;
    map.set(key, entry);
  }

  return Array.from(map.values()).sort((a, b) => a.time.localeCompare(b.time));
}

export default function PerformancePage() {
  const p50 = useLatencyMetrics('axiom.latency.p50');
  const p95 = useLatencyMetrics('axiom.latency.p95');
  const p99 = useLatencyMetrics('axiom.latency.p99');

  const isLoading = p50.isLoading || p95.isLoading || p99.isLoading;

  const chartData = mergeTimeseries(
    p50.data?.data ?? [],
    p95.data?.data ?? [],
    p99.data?.data ?? []
  );

  const latestP50 = p50.data?.data?.at(-1)?.value ?? 0;
  const latestP95 = p95.data?.data?.at(-1)?.value ?? 0;
  const latestP99 = p99.data?.data?.at(-1)?.value ?? 0;

  return (
    <div>
      <PageHeader
        title="Performance"
        description="Request latency percentiles from Axiom"
      />

      <SectionGrid columns={3} className="mb-6">
        <MetricCard
          label="P50 Latency"
          value={`${Math.round(latestP50)}`}
          unit="ms"
          status="healthy"
          className="animate-fade-up"
          style={{ animationDelay: '0ms' }}
        />
        <MetricCard
          label="P95 Latency"
          value={`${Math.round(latestP95)}`}
          unit="ms"
          status={latestP95 > 500 ? 'warning' : 'healthy'}
          className="animate-fade-up"
          style={{ animationDelay: '50ms' }}
        />
        <MetricCard
          label="P99 Latency"
          value={`${Math.round(latestP99)}`}
          unit="ms"
          status={latestP99 > 2000 ? 'critical' : latestP99 > 1000 ? 'warning' : 'healthy'}
          className="animate-fade-up"
          style={{ animationDelay: '100ms' }}
        />
      </SectionGrid>

      <ChartPanel
        title="Latency Over Time"
        subtitle="P50, P95, P99 response times"
        isLoading={isLoading}
        isEmpty={chartData.length === 0}
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="fillP50" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--mn-chart-2)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--mn-chart-2)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillP95" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--mn-chart-3)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--mn-chart-3)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillP99" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--mn-chart-5)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--mn-chart-5)" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                tickFormatter={(v) => `${v}ms`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--mn-surface)',
                  borderColor: 'var(--mn-border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(t) => format(new Date(t as string), 'HH:mm:ss')}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: 'var(--mn-text-secondary)' }}
              />
              <Area
                type="monotone"
                dataKey="p50"
                name="P50"
                stroke="var(--mn-chart-2)"
                fill="url(#fillP50)"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="p95"
                name="P95"
                stroke="var(--mn-chart-3)"
                fill="url(#fillP95)"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="p99"
                name="P99"
                stroke="var(--mn-chart-5)"
                fill="url(#fillP99)"
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>
    </div>
  );
}
