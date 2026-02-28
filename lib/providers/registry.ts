import type { MonitoringProvider, ProviderFetchResult } from './types';
import {
  upsertProviderSnapshot,
  insertMetrics,
  updateProviderFetchStatus,
  upsertProviderConfig,
  getProviderConfig,
  logIngestion,
} from '@/lib/db/queries';

export class ProviderRegistry {
  private providers = new Map<string, MonitoringProvider>();

  register(provider: MonitoringProvider) {
    this.providers.set(provider.id, provider);
  }

  getAll(): MonitoringProvider[] {
    return Array.from(this.providers.values());
  }

  get(id: string): MonitoringProvider | undefined {
    return this.providers.get(id);
  }

  /** Execute all providers, respecting individual intervals */
  async executeAll(): Promise<{
    results: Array<{
      providerId: string;
      status: 'success' | 'error' | 'skipped';
      metricsCount: number;
      durationMs: number;
    }>;
  }> {
    const results = await Promise.all(
      this.getAll().map((p) => this.executeOne(p))
    );
    return { results };
  }

  private async executeOne(provider: MonitoringProvider): Promise<{
    providerId: string;
    status: 'success' | 'error' | 'skipped';
    metricsCount: number;
    durationMs: number;
  }> {
    const start = Date.now();

    // Ensure provider config exists in DB
    await upsertProviderConfig(
      provider.id,
      provider.name,
      provider.minIntervalSeconds
    );

    // Check if enough time has passed since last fetch
    const config = await getProviderConfig(provider.id);
    if (config?.lastFetchAt) {
      const elapsed = (Date.now() - config.lastFetchAt.getTime()) / 1000;
      if (elapsed < (config.intervalSeconds ?? provider.minIntervalSeconds)) {
        const duration = Date.now() - start;
        await logIngestion({
          providerId: provider.id,
          status: 'skipped',
          durationMs: duration,
        });
        return {
          providerId: provider.id,
          status: 'skipped',
          metricsCount: 0,
          durationMs: duration,
        };
      }
    }

    let result: ProviderFetchResult | null = null;
    try {
      result = await provider.fetch();
    } catch {
      // BaseProvider.fetch() should never throw, but guard anyway
    }

    const duration = Date.now() - start;

    if (!result) {
      await updateProviderFetchStatus(provider.id, false);
      await logIngestion({
        providerId: provider.id,
        status: 'error',
        durationMs: duration,
        error: 'Provider returned null',
      });
      return {
        providerId: provider.id,
        status: 'error',
        metricsCount: 0,
        durationMs: duration,
      };
    }

    // Persist snapshot + metrics
    await upsertProviderSnapshot(
      result.snapshot.providerId,
      result.snapshot.data,
      result.snapshot.fetchedAt
    );

    await insertMetrics(
      result.metrics.map((m) => ({
        metricKey: m.key,
        value: m.value,
        unit: m.unit,
        tags: m.tags,
        timestamp: m.timestamp,
      }))
    );

    await updateProviderFetchStatus(provider.id, true);
    await logIngestion({
      providerId: provider.id,
      status: 'success',
      metricsCount: result.metrics.length,
      durationMs: duration,
    });

    return {
      providerId: provider.id,
      status: 'success',
      metricsCount: result.metrics.length,
      durationMs: duration,
    };
  }
}
