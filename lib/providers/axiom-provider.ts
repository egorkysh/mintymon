import { BaseProvider } from './base-provider';
import type { ProviderFetchResult, MetricDataPoint } from './types';

export class AxiomProvider extends BaseProvider {
  readonly id = 'axiom';
  readonly name = 'Axiom Latency';
  readonly minIntervalSeconds = 60;
  readonly metricKeys = [
    'axiom.latency.p50',
    'axiom.latency.p95',
    'axiom.latency.p99',
    'axiom.requests.total',
    'axiom.requests.error_rate',
  ] as const;

  private async aplQuery(apl: string) {
    const token = process.env.AXIOM_TOKEN;
    const orgId = process.env.AXIOM_ORG_ID;

    if (!token) throw new Error('AXIOM_TOKEN is required');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (orgId) headers['X-Axiom-Org-Id'] = orgId;

    const res = await fetch('https://api.axiom.co/v1/datasets/_apl', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        apl,
        startTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        endTime: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      throw new Error(`Axiom API error: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }

  protected async doFetch(): Promise<ProviderFetchResult> {
    const dataset = process.env.AXIOM_DATASET ?? 'mintcv-prod';

    // Query latency percentiles and request counts
    const result = await this.aplQuery(
      `['${dataset}']
       | summarize
           p50 = percentile(duration, 50),
           p95 = percentile(duration, 95),
           p99 = percentile(duration, 99),
           total = count(),
           errors = countif(status >= 500)`
    );

    const now = new Date();

    // Extract values from APL response
    const tables = result.tables ?? [];
    const firstTable = tables[0];
    const columns = firstTable?.columns ?? [];
    const row = firstTable?.columns?.[0]?.data?.length > 0 ? 0 : -1;

    const getValue = (name: string): number => {
      const colIndex = columns.findIndex(
        (c: { name: string }) => c.name === name
      );
      if (colIndex === -1 || row === -1) return 0;
      return Number(columns[colIndex].data?.[row]) || 0;
    };

    const p50 = getValue('p50');
    const p95 = getValue('p95');
    const p99 = getValue('p99');
    const total = getValue('total');
    const errors = getValue('errors');
    const errorRate = total > 0 ? (errors / total) * 100 : 0;

    const metrics: MetricDataPoint[] = [
      { key: 'axiom.latency.p50', value: Math.round(p50), unit: 'ms', timestamp: now },
      { key: 'axiom.latency.p95', value: Math.round(p95), unit: 'ms', timestamp: now },
      { key: 'axiom.latency.p99', value: Math.round(p99), unit: 'ms', timestamp: now },
      { key: 'axiom.requests.total', value: total, unit: 'count', timestamp: now },
      {
        key: 'axiom.requests.error_rate',
        value: Math.round(errorRate * 100) / 100,
        unit: 'percent',
        timestamp: now,
      },
    ];

    return {
      snapshot: {
        providerId: this.id,
        data: {
          p50,
          p95,
          p99,
          totalRequests: total,
          errors,
          errorRate,
          queriedAt: now.toISOString(),
        },
        fetchedAt: now,
      },
      metrics,
    };
  }
}
