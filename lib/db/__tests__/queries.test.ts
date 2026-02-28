import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Chainable mock builder ──────────────────────────────────────────
// Every method returns `chain` so calls like
//   db.select().from().where().orderBy().limit()
// resolve to the same awaitable object whose value we control via
// `chain.__resolve`.

function createChain() {
  let resolvedValue: unknown = [];

  const chain: Record<string, unknown> = {};
  const methods = [
    'select',
    'from',
    'where',
    'limit',
    'orderBy',
    'insert',
    'values',
    'onConflictDoUpdate',
    'returning',
    'update',
    'set',
    'delete',
  ];

  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }

  // Make the chain awaitable – `await db.select().from()…` resolves via
  // the standard thenable protocol.
  chain.then = (resolve: (v: unknown) => void) => resolve(resolvedValue);

  // Helper to set the resolved value for the next awaited call.
  chain.__resolve = (v: unknown) => {
    resolvedValue = v;
  };

  return chain as ReturnType<typeof createChain> & {
    __resolve: (v: unknown) => void;
    [k: string]: ReturnType<typeof vi.fn> | unknown;
  };
}

// ── Module-level mock ───────────────────────────────────────────────
const chain = createChain();

vi.mock('@/lib/db', () => ({ db: chain }));

// We do NOT need to mock the schema – the real column references work
// fine since they are only used as identity tokens inside drizzle
// operators. Drizzle-orm operator functions (eq, and, gte …) are also
// kept real; we only care that the db methods are invoked correctly.

// ── Import the module under test AFTER the mock is registered ───────
const {
  getProviderSnapshot,
  upsertProviderSnapshot,
  getProviderConfig,
  upsertProviderConfig,
  updateProviderFetchStatus,
  insertMetrics,
  getTimeseries,
  getLatestMetricValue,
  getEnabledAlertConfigs,
  getAllAlertConfigs,
  createAlertConfig,
  updateAlertConfig,
  deleteAlertConfig,
  insertAlertEvent,
  getAlertHistory,
  logIngestion,
} = await import('../queries');

// ── Helpers ─────────────────────────────────────────────────────────

beforeEach(() => {
  // Clear call counts but keep the mockReturnValue wiring.
  for (const key of Object.keys(chain)) {
    if (key === 'then' || key === '__resolve') continue;
    (chain[key] as ReturnType<typeof vi.fn>).mockClear();
  }
  chain.__resolve([]);
});

// ────────────────────────────────────────────────────────────────────
// Provider Cache
// ────────────────────────────────────────────────────────────────────

describe('getProviderSnapshot', () => {
  it('returns the row when found', async () => {
    const row = { providerId: 'vercel', data: { ok: true } };
    chain.__resolve([row]);

    const result = await getProviderSnapshot('vercel');

    expect(result).toEqual(row);
    expect(chain.select).toHaveBeenCalled();
    expect(chain.from).toHaveBeenCalled();
    expect(chain.where).toHaveBeenCalled();
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it('returns null when no rows', async () => {
    chain.__resolve([]);

    const result = await getProviderSnapshot('missing');

    expect(result).toBeNull();
  });
});

describe('upsertProviderSnapshot', () => {
  it('calls insert with correct values and conflict handling', async () => {
    const data = { cpu: 42 };
    const fetchedAt = new Date('2025-01-01');

    await upsertProviderSnapshot('vercel', data, fetchedAt);

    expect(chain.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'vercel', data, fetchedAt })
    );
    expect(chain.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({ data, fetchedAt }),
      })
    );
  });
});

// ────────────────────────────────────────────────────────────────────
// Provider Configs
// ────────────────────────────────────────────────────────────────────

describe('getProviderConfig', () => {
  it('returns config when found', async () => {
    const config = { providerId: 'github', name: 'GitHub' };
    chain.__resolve([config]);

    const result = await getProviderConfig('github');

    expect(result).toEqual(config);
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it('returns null when no config', async () => {
    chain.__resolve([]);

    const result = await getProviderConfig('nope');

    expect(result).toBeNull();
  });
});

describe('upsertProviderConfig', () => {
  it('calls insert with conflict handling', async () => {
    await upsertProviderConfig('github', 'GitHub', 120);

    expect(chain.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'github',
        name: 'GitHub',
        intervalSeconds: 120,
      })
    );
    expect(chain.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({ name: 'GitHub', intervalSeconds: 120 }),
      })
    );
  });
});

describe('updateProviderFetchStatus', () => {
  it('resets consecutiveFailures on success', async () => {
    await updateProviderFetchStatus('vercel', true);

    expect(chain.update).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ consecutiveFailures: 0 })
    );
    expect(chain.where).toHaveBeenCalled();
  });

  it('increments consecutiveFailures on failure', async () => {
    await updateProviderFetchStatus('vercel', false);

    expect(chain.update).toHaveBeenCalled();
    // On failure the set call should NOT contain consecutiveFailures: 0
    const setArg = (chain.set as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(setArg.consecutiveFailures).not.toBe(0);
    expect(chain.where).toHaveBeenCalled();
  });

  it('sets lastFetchAt on both success and failure', async () => {
    await updateProviderFetchStatus('p1', true);
    const successSet = (chain.set as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(successSet.lastFetchAt).toBeInstanceOf(Date);

    (chain.set as ReturnType<typeof vi.fn>).mockClear();

    await updateProviderFetchStatus('p1', false);
    const failureSet = (chain.set as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(failureSet.lastFetchAt).toBeInstanceOf(Date);
  });

  it('sets lastSuccessAt only on success path', async () => {
    await updateProviderFetchStatus('p1', true);
    const successSet = (chain.set as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(successSet.lastSuccessAt).toBeInstanceOf(Date);

    (chain.set as ReturnType<typeof vi.fn>).mockClear();

    await updateProviderFetchStatus('p1', false);
    const failureSet = (chain.set as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(failureSet).not.toHaveProperty('lastSuccessAt');
  });
});

// ────────────────────────────────────────────────────────────────────
// Metric Data
// ────────────────────────────────────────────────────────────────────

describe('insertMetrics', () => {
  it('short-circuits when array is empty', async () => {
    await insertMetrics([]);

    expect(chain.insert).not.toHaveBeenCalled();
  });

  it('inserts when metrics are provided', async () => {
    const metrics = [
      {
        metricKey: 'cpu',
        value: 55,
        unit: '%',
        timestamp: new Date(),
      },
    ];

    await insertMetrics(metrics);

    expect(chain.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalledWith(metrics);
  });
});

describe('getTimeseries', () => {
  it('passes correct where clauses and respects limit', async () => {
    const from = new Date('2025-01-01');
    const to = new Date('2025-01-31');
    const fakeRows = [{ metricKey: 'cpu', value: 42 }];
    chain.__resolve(fakeRows);

    const result = await getTimeseries('cpu', from, to, 500);

    expect(chain.select).toHaveBeenCalled();
    expect(chain.from).toHaveBeenCalled();
    expect(chain.where).toHaveBeenCalled();
    expect(chain.orderBy).toHaveBeenCalled();
    expect(chain.limit).toHaveBeenCalledWith(500);
    expect(result).toEqual(fakeRows);
  });

  it('uses default limit of 1000', async () => {
    const from = new Date('2025-01-01');
    const to = new Date('2025-01-31');

    await getTimeseries('cpu', from, to);

    expect(chain.limit).toHaveBeenCalledWith(1000);
  });
});

describe('getLatestMetricValue', () => {
  it('returns the latest row', async () => {
    const row = { metricKey: 'mem', value: 70 };
    chain.__resolve([row]);

    const result = await getLatestMetricValue('mem');

    expect(result).toEqual(row);
    expect(chain.orderBy).toHaveBeenCalled();
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it('returns null when no rows', async () => {
    chain.__resolve([]);

    const result = await getLatestMetricValue('nope');

    expect(result).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────
// Alert Configs
// ────────────────────────────────────────────────────────────────────

describe('getEnabledAlertConfigs', () => {
  it('filters by enabled=true', async () => {
    const configs = [{ name: 'High CPU', enabled: true }];
    chain.__resolve(configs);

    const result = await getEnabledAlertConfigs();

    expect(result).toEqual(configs);
    expect(chain.select).toHaveBeenCalled();
    expect(chain.from).toHaveBeenCalled();
    expect(chain.where).toHaveBeenCalled();
  });
});

describe('getAllAlertConfigs', () => {
  it('returns ordered by createdAt desc', async () => {
    const configs = [
      { name: 'B', createdAt: '2025-02-01' },
      { name: 'A', createdAt: '2025-01-01' },
    ];
    chain.__resolve(configs);

    const result = await getAllAlertConfigs();

    expect(result).toEqual(configs);
    expect(chain.select).toHaveBeenCalled();
    expect(chain.from).toHaveBeenCalled();
    expect(chain.orderBy).toHaveBeenCalled();
  });
});

describe('createAlertConfig', () => {
  it('returns the created row', async () => {
    const input = {
      name: 'High CPU',
      metricKey: 'cpu',
      condition: 'gt' as const,
      threshold: 80,
    };
    const created = { id: 'uuid-1', ...input };
    chain.__resolve([created]);

    const result = await createAlertConfig(input);

    expect(result).toEqual(created);
    expect(chain.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalledWith(input);
    expect(chain.returning).toHaveBeenCalled();
  });
});

describe('updateAlertConfig', () => {
  it('applies partial updates', async () => {
    const updates = { name: 'Renamed', threshold: 90 };

    await updateAlertConfig('uuid-1', updates);

    expect(chain.update).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Renamed', threshold: 90 })
    );
    expect(chain.where).toHaveBeenCalled();
  });

  it('includes updatedAt in the set call', async () => {
    await updateAlertConfig('uuid-1', { enabled: false });

    const setArg = (chain.set as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(setArg.updatedAt).toBeInstanceOf(Date);
  });
});

describe('deleteAlertConfig', () => {
  it('deletes by id', async () => {
    await deleteAlertConfig('uuid-1');

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.where).toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────
// Alert History
// ────────────────────────────────────────────────────────────────────

describe('insertAlertEvent', () => {
  it('inserts event', async () => {
    const event = {
      alertConfigId: 'cfg-1',
      type: 'fired' as const,
      metricKey: 'cpu',
      metricValue: 95,
      threshold: 80,
      message: 'CPU too high',
    };

    await insertAlertEvent(event);

    expect(chain.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalledWith(event);
  });
});

describe('getAlertHistory', () => {
  it('respects custom limit', async () => {
    const history = [{ type: 'fired' }];
    chain.__resolve(history);

    const result = await getAlertHistory(50);

    expect(result).toEqual(history);
    expect(chain.orderBy).toHaveBeenCalled();
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it('uses default limit of 100', async () => {
    await getAlertHistory();

    expect(chain.limit).toHaveBeenCalledWith(100);
  });
});

// ────────────────────────────────────────────────────────────────────
// Ingestion Log
// ────────────────────────────────────────────────────────────────────

describe('logIngestion', () => {
  it('inserts entry', async () => {
    const entry = {
      providerId: 'vercel',
      status: 'success' as const,
      metricsCount: 5,
      durationMs: 120,
    };

    await logIngestion(entry);

    expect(chain.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalledWith(entry);
  });

  it('handles entry with error field', async () => {
    const entry = {
      status: 'error' as const,
      error: 'timeout',
    };

    await logIngestion(entry);

    expect(chain.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalledWith(entry);
  });
});
