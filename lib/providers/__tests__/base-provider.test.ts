import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseProvider } from '../base-provider';
import type { ProviderFetchResult } from '../types';

// Concrete subclass to test abstract BaseProvider
class TestProvider extends BaseProvider {
  readonly id = 'test-provider';
  readonly name = 'Test Provider';
  readonly minIntervalSeconds = 60;
  readonly metricKeys = ['test.metric'] as const;

  doFetchImpl: () => Promise<ProviderFetchResult> = () => {
    throw new Error('doFetchImpl not set');
  };

  protected doFetch(): Promise<ProviderFetchResult> {
    return this.doFetchImpl();
  }
}

function makeResult(overrides?: Partial<ProviderFetchResult>): ProviderFetchResult {
  return {
    snapshot: {
      providerId: 'test-provider',
      data: { value: 42 },
      fetchedAt: new Date(),
    },
    metrics: [
      {
        key: 'test.metric',
        value: 42,
        unit: 'count',
        timestamp: new Date(),
      },
    ],
    ...overrides,
  };
}

describe('BaseProvider', () => {
  let provider: TestProvider;

  beforeEach(() => {
    vi.useFakeTimers();
    provider = new TestProvider();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns result and stays healthy on successful fetch', async () => {
    const expected = makeResult();
    provider.doFetchImpl = vi.fn().mockResolvedValue(expected);

    const fetchPromise = provider.fetch();
    // No timers to advance on success path
    const result = await fetchPromise;

    expect(result).toBe(expected);
    expect(provider.getStatus()).toBe('healthy');
    expect(provider.doFetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries with exponential backoff on failure, then returns null', async () => {
    const error = new Error('fetch failed');
    provider.doFetchImpl = vi.fn().mockRejectedValue(error);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const fetchPromise = provider.fetch();

    // First attempt fails, waits 1000ms (1000 * 2^0)
    await vi.advanceTimersByTimeAsync(1000);
    // Second attempt fails, waits 2000ms (1000 * 2^1)
    await vi.advanceTimersByTimeAsync(2000);
    // Third attempt fails, no more retries

    const result = await fetchPromise;

    expect(result).toBeNull();
    // 1 initial + 2 retries = 3 total attempts
    expect(provider.doFetchImpl).toHaveBeenCalledTimes(3);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[test-provider] fetch failed after 3 attempts:'),
      'fetch failed'
    );

    consoleSpy.mockRestore();
  });

  it('sets status to degraded after first failure', async () => {
    provider.doFetchImpl = vi.fn().mockRejectedValue(new Error('fail'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const fetchPromise = provider.fetch();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await fetchPromise;

    expect(provider.getStatus()).toBe('degraded');
  });

  it('sets status to degraded after second failure', async () => {
    provider.doFetchImpl = vi.fn().mockRejectedValue(new Error('fail'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // First complete failure cycle
    const p1 = provider.fetch();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await p1;
    expect(provider.getStatus()).toBe('degraded');

    // Second complete failure cycle
    const p2 = provider.fetch();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await p2;
    expect(provider.getStatus()).toBe('degraded');
  });

  it('sets status to error after 3+ consecutive failures', async () => {
    provider.doFetchImpl = vi.fn().mockRejectedValue(new Error('fail'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Three complete failure cycles
    for (let i = 0; i < 3; i++) {
      const p = provider.fetch();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await p;
    }

    expect(provider.getStatus()).toBe('error');
  });

  it('resets to healthy after a successful fetch following failures', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Cause 3 failures to reach 'error' status
    provider.doFetchImpl = vi.fn().mockRejectedValue(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      const p = provider.fetch();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await p;
    }
    expect(provider.getStatus()).toBe('error');

    // Now succeed
    provider.doFetchImpl = vi.fn().mockResolvedValue(makeResult());
    const result = await provider.fetch();

    expect(result).not.toBeNull();
    expect(provider.getStatus()).toBe('healthy');

    consoleSpy.mockRestore();
  });

  it('succeeds on retry if second attempt works', async () => {
    let callCount = 0;
    provider.doFetchImpl = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error('transient'));
      return Promise.resolve(makeResult());
    });

    const fetchPromise = provider.fetch();
    // First attempt fails, wait for retry delay (1000ms)
    await vi.advanceTimersByTimeAsync(1000);

    const result = await fetchPromise;

    expect(result).not.toBeNull();
    expect(provider.getStatus()).toBe('healthy');
    expect(provider.doFetchImpl).toHaveBeenCalledTimes(2);
  });

  it('succeeds on third attempt if first two fail', async () => {
    let callCount = 0;
    provider.doFetchImpl = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) return Promise.reject(new Error('transient'));
      return Promise.resolve(makeResult());
    });

    const fetchPromise = provider.fetch();
    await vi.advanceTimersByTimeAsync(1000); // retry 1 delay
    await vi.advanceTimersByTimeAsync(2000); // retry 2 delay

    const result = await fetchPromise;

    expect(result).not.toBeNull();
    expect(provider.getStatus()).toBe('healthy');
    expect(provider.doFetchImpl).toHaveBeenCalledTimes(3);
  });

  it('logs non-Error thrown values', async () => {
    provider.doFetchImpl = vi.fn().mockRejectedValue('string error');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const fetchPromise = provider.fetch();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await fetchPromise;

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[test-provider]'),
      'string error'
    );

    consoleSpy.mockRestore();
  });
});
