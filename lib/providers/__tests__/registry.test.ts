import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MonitoringProvider, ProviderFetchResult } from '../types';

// Mock @/lib/db/queries before importing registry
vi.mock('@/lib/db/queries', () => ({
  upsertProviderSnapshot: vi.fn().mockResolvedValue(undefined),
  insertMetrics: vi.fn().mockResolvedValue(undefined),
  updateProviderFetchStatus: vi.fn().mockResolvedValue(undefined),
  upsertProviderConfig: vi.fn().mockResolvedValue(undefined),
  getProviderConfig: vi.fn().mockResolvedValue(null),
  logIngestion: vi.fn().mockResolvedValue(undefined),
}));

import { ProviderRegistry } from '../registry';
import {
  upsertProviderSnapshot,
  insertMetrics,
  updateProviderFetchStatus,
  upsertProviderConfig,
  getProviderConfig,
  logIngestion,
} from '@/lib/db/queries';

function createMockProvider(
  overrides?: Partial<MonitoringProvider>
): MonitoringProvider {
  return {
    id: 'mock-provider',
    name: 'Mock Provider',
    minIntervalSeconds: 60,
    metricKeys: ['mock.metric'] as const,
    fetch: vi.fn().mockResolvedValue({
      snapshot: {
        providerId: 'mock-provider',
        data: { value: 1 },
        fetchedAt: new Date(),
      },
      metrics: [
        {
          key: 'mock.metric',
          value: 42,
          unit: 'count',
          timestamp: new Date(),
        },
      ],
    } satisfies ProviderFetchResult),
    getStatus: vi.fn().mockReturnValue('healthy'),
    ...overrides,
  };
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
    vi.clearAllMocks();
  });

  describe('register and getAll', () => {
    it('registers a single provider and retrieves it', () => {
      const provider = createMockProvider();
      registry.register(provider);

      const all = registry.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toBe(provider);
    });

    it('registers multiple providers', () => {
      const p1 = createMockProvider({ id: 'p1', name: 'Provider 1' });
      const p2 = createMockProvider({ id: 'p2', name: 'Provider 2' });
      const p3 = createMockProvider({ id: 'p3', name: 'Provider 3' });

      registry.register(p1);
      registry.register(p2);
      registry.register(p3);

      const all = registry.getAll();
      expect(all).toHaveLength(3);
    });

    it('overwrites provider when registering with same id', () => {
      const p1 = createMockProvider({ id: 'same-id', name: 'First' });
      const p2 = createMockProvider({ id: 'same-id', name: 'Second' });

      registry.register(p1);
      registry.register(p2);

      const all = registry.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('Second');
    });

    it('returns empty array when no providers registered', () => {
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('get', () => {
    it('returns the correct provider by id', () => {
      const p1 = createMockProvider({ id: 'alpha' });
      const p2 = createMockProvider({ id: 'beta' });

      registry.register(p1);
      registry.register(p2);

      expect(registry.get('alpha')).toBe(p1);
      expect(registry.get('beta')).toBe(p2);
    });

    it('returns undefined for unknown id', () => {
      registry.register(createMockProvider({ id: 'known' }));
      expect(registry.get('unknown')).toBeUndefined();
    });
  });

  describe('executeAll', () => {
    it('runs all providers and returns results', async () => {
      const p1 = createMockProvider({ id: 'p1' });
      const p2 = createMockProvider({ id: 'p2' });

      registry.register(p1);
      registry.register(p2);

      const { results } = await registry.executeAll();

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.providerId)).toEqual(
        expect.arrayContaining(['p1', 'p2'])
      );
      for (const r of results) {
        expect(r.status).toBe('success');
      }
    });

    it('returns empty results when no providers registered', async () => {
      const { results } = await registry.executeAll();
      expect(results).toEqual([]);
    });

    it('skips provider when recently fetched (interval not elapsed)', async () => {
      const provider = createMockProvider({
        id: 'interval-test',
        minIntervalSeconds: 300,
      });
      registry.register(provider);

      // Simulate that last fetch was 10 seconds ago
      vi.mocked(getProviderConfig).mockResolvedValueOnce({
        providerId: 'interval-test',
        name: 'Interval Test',
        intervalSeconds: 300,
        lastFetchAt: new Date(Date.now() - 10_000), // 10 seconds ago
        lastSuccessAt: null,
        consecutiveFailures: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { results } = await registry.executeAll();

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('skipped');
      expect(results[0].metricsCount).toBe(0);
      expect(provider.fetch).not.toHaveBeenCalled();
    });
  });

  describe('executeOne (via executeAll)', () => {
    it('success path: persists snapshot, metrics, and logs success', async () => {
      const now = new Date();
      const fetchResult: ProviderFetchResult = {
        snapshot: {
          providerId: 'persist-test',
          data: { val: 123 },
          fetchedAt: now,
        },
        metrics: [
          { key: 'test.m1', value: 10, unit: 'ms', timestamp: now },
          { key: 'test.m2', value: 20, unit: 'count', timestamp: now },
        ],
      };

      const provider = createMockProvider({
        id: 'persist-test',
        fetch: vi.fn().mockResolvedValue(fetchResult),
      });
      registry.register(provider);

      const { results } = await registry.executeAll();

      expect(results[0].status).toBe('success');
      expect(results[0].metricsCount).toBe(2);
      expect(results[0].durationMs).toBeGreaterThanOrEqual(0);

      // Verify upsertProviderConfig was called
      expect(upsertProviderConfig).toHaveBeenCalledWith(
        'persist-test',
        provider.name,
        provider.minIntervalSeconds
      );

      // Verify snapshot was persisted
      expect(upsertProviderSnapshot).toHaveBeenCalledWith(
        'persist-test',
        { val: 123 },
        now
      );

      // Verify metrics were persisted
      expect(insertMetrics).toHaveBeenCalledWith([
        { metricKey: 'test.m1', value: 10, unit: 'ms', tags: undefined, timestamp: now },
        { metricKey: 'test.m2', value: 20, unit: 'count', tags: undefined, timestamp: now },
      ]);

      // Verify status updated as success
      expect(updateProviderFetchStatus).toHaveBeenCalledWith(
        'persist-test',
        true
      );

      // Verify success logged
      expect(logIngestion).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'persist-test',
          status: 'success',
          metricsCount: 2,
        })
      );
    });

    it('failure path: provider returns null, updates status and logs error', async () => {
      const provider = createMockProvider({
        id: 'fail-test',
        fetch: vi.fn().mockResolvedValue(null),
      });
      registry.register(provider);

      const { results } = await registry.executeAll();

      expect(results[0].status).toBe('error');
      expect(results[0].metricsCount).toBe(0);

      // Should not persist snapshot or metrics
      expect(upsertProviderSnapshot).not.toHaveBeenCalled();
      expect(insertMetrics).not.toHaveBeenCalled();

      // Should update fetch status as failure
      expect(updateProviderFetchStatus).toHaveBeenCalledWith(
        'fail-test',
        false
      );

      // Should log error
      expect(logIngestion).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'fail-test',
          status: 'error',
          error: 'Provider returned null',
        })
      );
    });

    it('skips when not enough time has elapsed since last fetch', async () => {
      const provider = createMockProvider({
        id: 'skip-test',
        minIntervalSeconds: 120,
      });
      registry.register(provider);

      // Last fetch was 30 seconds ago, interval is 120 seconds
      vi.mocked(getProviderConfig).mockResolvedValueOnce({
        providerId: 'skip-test',
        name: 'Skip Test',
        intervalSeconds: 120,
        lastFetchAt: new Date(Date.now() - 30_000),
        lastSuccessAt: null,
        consecutiveFailures: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { results } = await registry.executeAll();

      expect(results[0].status).toBe('skipped');
      expect(results[0].metricsCount).toBe(0);

      // Provider fetch should not have been called
      expect(provider.fetch).not.toHaveBeenCalled();

      // Should not persist anything
      expect(upsertProviderSnapshot).not.toHaveBeenCalled();
      expect(insertMetrics).not.toHaveBeenCalled();
      expect(updateProviderFetchStatus).not.toHaveBeenCalled();

      // Should log the skip
      expect(logIngestion).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'skip-test',
          status: 'skipped',
        })
      );
    });

    it('executes when enough time has elapsed since last fetch', async () => {
      const provider = createMockProvider({
        id: 'elapsed-test',
        minIntervalSeconds: 60,
      });
      registry.register(provider);

      // Last fetch was 120 seconds ago, interval is 60 seconds
      vi.mocked(getProviderConfig).mockResolvedValueOnce({
        providerId: 'elapsed-test',
        name: 'Elapsed Test',
        intervalSeconds: 60,
        lastFetchAt: new Date(Date.now() - 120_000),
        lastSuccessAt: null,
        consecutiveFailures: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { results } = await registry.executeAll();

      expect(results[0].status).toBe('success');
      expect(provider.fetch).toHaveBeenCalledTimes(1);
    });

    it('executes when config has no lastFetchAt (first run)', async () => {
      const provider = createMockProvider({
        id: 'first-run',
        minIntervalSeconds: 60,
      });
      registry.register(provider);

      vi.mocked(getProviderConfig).mockResolvedValueOnce({
        providerId: 'first-run',
        name: 'First Run',
        intervalSeconds: 60,
        lastFetchAt: null,
        lastSuccessAt: null,
        consecutiveFailures: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { results } = await registry.executeAll();

      expect(results[0].status).toBe('success');
      expect(provider.fetch).toHaveBeenCalledTimes(1);
    });

    it('executes when getProviderConfig returns null (no config yet)', async () => {
      const provider = createMockProvider({ id: 'no-config' });
      registry.register(provider);

      vi.mocked(getProviderConfig).mockResolvedValueOnce(null);

      const { results } = await registry.executeAll();

      expect(results[0].status).toBe('success');
      expect(provider.fetch).toHaveBeenCalledTimes(1);
    });

    it('uses provider minIntervalSeconds when config intervalSeconds is null', async () => {
      const provider = createMockProvider({
        id: 'fallback-interval',
        minIntervalSeconds: 60,
      });
      registry.register(provider);

      // intervalSeconds is null, last fetch was 30 seconds ago
      // Should fall back to minIntervalSeconds (60) and skip
      vi.mocked(getProviderConfig).mockResolvedValueOnce({
        providerId: 'fallback-interval',
        name: 'Fallback',
        intervalSeconds: null as unknown as number,
        lastFetchAt: new Date(Date.now() - 30_000),
        lastSuccessAt: null,
        consecutiveFailures: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { results } = await registry.executeAll();
      expect(results[0].status).toBe('skipped');
    });

    it('handles provider.fetch() throwing an exception', async () => {
      const provider = createMockProvider({
        id: 'throw-test',
        fetch: vi.fn().mockRejectedValue(new Error('unexpected')),
      });
      registry.register(provider);

      const { results } = await registry.executeAll();

      // The try/catch in executeOne catches the thrown error and treats as null result
      expect(results[0].status).toBe('error');
      expect(results[0].metricsCount).toBe(0);

      expect(updateProviderFetchStatus).toHaveBeenCalledWith(
        'throw-test',
        false
      );
    });

    it('includes metrics with tags in persisted data', async () => {
      const now = new Date();
      const fetchResult: ProviderFetchResult = {
        snapshot: {
          providerId: 'tags-test',
          data: {},
          fetchedAt: now,
        },
        metrics: [
          {
            key: 'tagged.metric',
            value: 99,
            unit: 'count',
            tags: { env: 'prod', region: 'us-east' },
            timestamp: now,
          },
        ],
      };

      const provider = createMockProvider({
        id: 'tags-test',
        fetch: vi.fn().mockResolvedValue(fetchResult),
      });
      registry.register(provider);

      await registry.executeAll();

      expect(insertMetrics).toHaveBeenCalledWith([
        {
          metricKey: 'tagged.metric',
          value: 99,
          unit: 'count',
          tags: { env: 'prod', region: 'us-east' },
          timestamp: now,
        },
      ]);
    });
  });
});
