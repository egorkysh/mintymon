export interface MetricDataPoint {
  key: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  timestamp: Date;
}

export interface ProviderFetchResult {
  snapshot: {
    providerId: string;
    data: Record<string, unknown>;
    fetchedAt: Date;
  };
  metrics: MetricDataPoint[];
}

export interface MonitoringProvider {
  readonly id: string;
  readonly name: string;
  readonly minIntervalSeconds: number;
  readonly metricKeys: readonly string[];
  fetch(): Promise<ProviderFetchResult | null>;
  getStatus(): 'healthy' | 'degraded' | 'error';
}
