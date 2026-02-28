import type { MonitoringProvider, ProviderFetchResult } from './types';

export abstract class BaseProvider implements MonitoringProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly minIntervalSeconds: number;
  abstract readonly metricKeys: readonly string[];

  private status: 'healthy' | 'degraded' | 'error' = 'healthy';
  private consecutiveErrors = 0;

  private static readonly MAX_RETRIES = 2;
  private static readonly BASE_DELAY_MS = 1000;

  getStatus(): 'healthy' | 'degraded' | 'error' {
    return this.status;
  }

  async fetch(): Promise<ProviderFetchResult | null> {
    for (let attempt = 0; attempt <= BaseProvider.MAX_RETRIES; attempt++) {
      try {
        const result = await this.doFetch();
        this.consecutiveErrors = 0;
        this.status = 'healthy';
        return result;
      } catch (err) {
        if (attempt < BaseProvider.MAX_RETRIES) {
          const delay = BaseProvider.BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        this.consecutiveErrors++;
        this.status = this.consecutiveErrors >= 3 ? 'error' : 'degraded';
        console.error(
          `[${this.id}] fetch failed after ${BaseProvider.MAX_RETRIES + 1} attempts:`,
          err instanceof Error ? err.message : err
        );
        return null;
      }
    }
    return null;
  }

  /** Subclasses implement their actual data fetching here */
  protected abstract doFetch(): Promise<ProviderFetchResult>;
}
