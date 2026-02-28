import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiomProvider } from '../axiom-provider';

describe('AxiomProvider', () => {
  let provider: AxiomProvider;
  const originalEnv = { ...process.env };
  const mockFetch = vi.fn();

  beforeEach(() => {
    provider = new AxiomProvider();
    process.env.AXIOM_TOKEN = 'test-axiom-token';
    process.env.AXIOM_ORG_ID = 'org-123';
    process.env.AXIOM_DATASET = 'my-dataset';
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('has correct provider metadata', () => {
    expect(provider.id).toBe('axiom');
    expect(provider.name).toBe('Axiom Latency');
    expect(provider.minIntervalSeconds).toBe(60);
    expect(provider.metricKeys).toEqual([
      'axiom.latency.p50',
      'axiom.latency.p95',
      'axiom.latency.p99',
      'axiom.requests.total',
      'axiom.requests.error_rate',
    ]);
  });

  it('throws when AXIOM_TOKEN is missing', async () => {
    delete process.env.AXIOM_TOKEN;
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await provider.fetch();
    expect(result).toBeNull();
  });

  it('sends correct APL query with custom dataset', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tables: [
          {
            columns: [
              { name: 'p50', data: [120] },
              { name: 'p95', data: [350] },
              { name: 'p99', data: [900] },
              { name: 'total', data: [5000] },
              { name: 'errors', data: [50] },
            ],
          },
        ],
      }),
    });

    await provider.fetch();

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.axiom.co/v1/datasets/_apl');
    expect(options.method).toBe('POST');

    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-axiom-token');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Axiom-Org-Id']).toBe('org-123');

    const body = JSON.parse(options.body as string);
    expect(body.apl).toContain("['my-dataset']");
    expect(body.apl).toContain('percentile(duration, 50)');
    expect(body.apl).toContain('percentile(duration, 95)');
    expect(body.apl).toContain('percentile(duration, 99)');
    expect(body.apl).toContain('count()');
    expect(body.apl).toContain('countif(status >= 500)');
    expect(body.startTime).toBeDefined();
    expect(body.endTime).toBeDefined();
  });

  it('parses table response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tables: [
          {
            columns: [
              { name: 'p50', data: [123.456] },
              { name: 'p95', data: [350.789] },
              { name: 'p99', data: [901.234] },
              { name: 'total', data: [10000] },
              { name: 'errors', data: [200] },
            ],
          },
        ],
      }),
    });

    const result = await provider.fetch();
    expect(result).not.toBeNull();

    // Verify snapshot data
    const data = result!.snapshot.data as Record<string, unknown>;
    expect(data.p50).toBe(123.456);
    expect(data.p95).toBe(350.789);
    expect(data.p99).toBe(901.234);
    expect(data.totalRequests).toBe(10000);
    expect(data.errors).toBe(200);
    // errorRate = (200/10000) * 100 = 2
    expect(data.errorRate).toBe(2);
    expect(data.queriedAt).toBeDefined();

    // Verify metrics
    const metrics = result!.metrics;
    expect(metrics).toHaveLength(5);

    const p50 = metrics.find((m) => m.key === 'axiom.latency.p50');
    expect(p50!.value).toBe(123); // Math.round
    expect(p50!.unit).toBe('ms');

    const p95 = metrics.find((m) => m.key === 'axiom.latency.p95');
    expect(p95!.value).toBe(351); // Math.round(350.789)

    const p99 = metrics.find((m) => m.key === 'axiom.latency.p99');
    expect(p99!.value).toBe(901); // Math.round(901.234)

    const total = metrics.find((m) => m.key === 'axiom.requests.total');
    expect(total!.value).toBe(10000);
    expect(total!.unit).toBe('count');

    const errorRate = metrics.find((m) => m.key === 'axiom.requests.error_rate');
    expect(errorRate!.value).toBe(2);
    expect(errorRate!.unit).toBe('percent');
  });

  it('handles empty tables array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tables: [] }),
    });

    const result = await provider.fetch();
    expect(result).not.toBeNull();

    // All values should be 0 when no tables
    const data = result!.snapshot.data as Record<string, unknown>;
    expect(data.p50).toBe(0);
    expect(data.p95).toBe(0);
    expect(data.p99).toBe(0);
    expect(data.totalRequests).toBe(0);
    expect(data.errors).toBe(0);
    expect(data.errorRate).toBe(0);

    for (const metric of result!.metrics) {
      expect(metric.value).toBe(0);
    }
  });

  it('handles table with no rows (empty column data)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tables: [
          {
            columns: [
              { name: 'p50', data: [] },
              { name: 'p95', data: [] },
              { name: 'p99', data: [] },
              { name: 'total', data: [] },
              { name: 'errors', data: [] },
            ],
          },
        ],
      }),
    });

    const result = await provider.fetch();
    expect(result).not.toBeNull();

    // row = -1 when columns[0].length === 0, so all getValue returns 0
    const data = result!.snapshot.data as Record<string, unknown>;
    expect(data.p50).toBe(0);
    expect(data.totalRequests).toBe(0);
    expect(data.errorRate).toBe(0);
  });

  it('computes error rate correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tables: [
          {
            columns: [
              { name: 'p50', data: [100] },
              { name: 'p95', data: [200] },
              { name: 'p99', data: [300] },
              { name: 'total', data: [400] },
              { name: 'errors', data: [12] },
            ],
          },
        ],
      }),
    });

    const result = await provider.fetch();

    // errorRate = (12 / 400) * 100 = 3
    const data = result!.snapshot.data as Record<string, unknown>;
    expect(data.errorRate).toBe(3);

    const errorRateMetric = result!.metrics.find(
      (m) => m.key === 'axiom.requests.error_rate'
    );
    // Math.round(3 * 100) / 100 = 3
    expect(errorRateMetric!.value).toBe(3);
  });

  it('computes error rate with precision', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tables: [
          {
            columns: [
              { name: 'p50', data: [100] },
              { name: 'p95', data: [200] },
              { name: 'p99', data: [300] },
              { name: 'total', data: [300] },
              { name: 'errors', data: [7] },
            ],
          },
        ],
      }),
    });

    const result = await provider.fetch();

    // errorRate = (7 / 300) * 100 = 2.3333...
    // Math.round(2.3333 * 100) / 100 = 2.33
    const errorRateMetric = result!.metrics.find(
      (m) => m.key === 'axiom.requests.error_rate'
    );
    expect(errorRateMetric!.value).toBe(2.33);
  });

  it('error rate is 0 when total is 0', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tables: [
          {
            columns: [
              { name: 'p50', data: [0] },
              { name: 'p95', data: [0] },
              { name: 'p99', data: [0] },
              { name: 'total', data: [0] },
              { name: 'errors', data: [0] },
            ],
          },
        ],
      }),
    });

    const result = await provider.fetch();

    const data = result!.snapshot.data as Record<string, unknown>;
    expect(data.errorRate).toBe(0);
  });

  it('uses default dataset when AXIOM_DATASET is not set', async () => {
    delete process.env.AXIOM_DATASET;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tables: [
          {
            columns: [
              { name: 'p50', data: [100] },
              { name: 'p95', data: [200] },
              { name: 'p99', data: [300] },
              { name: 'total', data: [1000] },
              { name: 'errors', data: [10] },
            ],
          },
        ],
      }),
    });

    await provider.fetch();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.apl).toContain("['mintcv-prod']");
  });

  it('omits X-Axiom-Org-Id header when AXIOM_ORG_ID is not set', async () => {
    delete process.env.AXIOM_ORG_ID;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tables: [
          {
            columns: [
              { name: 'p50', data: [100] },
              { name: 'p95', data: [200] },
              { name: 'p99', data: [300] },
              { name: 'total', data: [1000] },
              { name: 'errors', data: [10] },
            ],
          },
        ],
      }),
    });

    await provider.fetch();

    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['X-Axiom-Org-Id']).toBeUndefined();
    expect(headers.Authorization).toBe('Bearer test-axiom-token');
  });

  it('handles non-ok response from Axiom API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await provider.fetch();
    expect(result).toBeNull();
  });

  it('handles missing column in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tables: [
          {
            columns: [
              { name: 'p50', data: [150] },
              // Missing p95, p99, total, errors columns
            ],
          },
        ],
      }),
    });

    const result = await provider.fetch();
    expect(result).not.toBeNull();

    const data = result!.snapshot.data as Record<string, unknown>;
    expect(data.p50).toBe(150);
    expect(data.p95).toBe(0); // missing column defaults to 0
    expect(data.p99).toBe(0);
    expect(data.totalRequests).toBe(0);
    expect(data.errors).toBe(0);
  });
});
