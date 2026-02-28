import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NeonProvider } from '../neon-provider';

describe('NeonProvider', () => {
  let provider: NeonProvider;
  const originalEnv = { ...process.env };
  const mockFetch = vi.fn();

  beforeEach(() => {
    provider = new NeonProvider();
    process.env.NEON_API_KEY = 'test-neon-key';
    process.env.NEON_PROJECT_ID = 'neon-proj-123';
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('has correct provider metadata', () => {
    expect(provider.id).toBe('neon');
    expect(provider.name).toBe('Neon Database');
    expect(provider.minIntervalSeconds).toBe(300);
    expect(provider.metricKeys).toEqual([
      'neon.db.size_bytes',
      'neon.db.compute_seconds',
      'neon.db.written_bytes',
    ]);
  });

  it('throws when NEON_API_KEY is missing', async () => {
    delete process.env.NEON_API_KEY;
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await provider.fetch();
    expect(result).toBeNull();
  });

  it('throws when NEON_PROJECT_ID is missing', async () => {
    delete process.env.NEON_PROJECT_ID;
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // neonFetch will succeed but doFetch will throw on missing projectId
    const result = await provider.fetch();
    expect(result).toBeNull();
  });

  it('fetches project, branches, and endpoints correctly', async () => {
    const projectResponse = {
      project: {
        id: 'neon-proj-123',
        name: 'my-neon-project',
        region_id: 'aws-us-east-2',
        created_at: '2024-01-01T00:00:00Z',
      },
    };

    const branchesResponse = {
      branches: [
        {
          id: 'br-main-1',
          name: 'main',
          logical_size: 1024000,
          written_data_bytes: 512000,
          compute_time_seconds: 3600,
          current_state: 'ready',
        },
        {
          id: 'br-dev-1',
          name: 'dev',
          logical_size: 2048000,
          written_data_bytes: 1024000,
          compute_time_seconds: 7200,
          current_state: 'ready',
        },
      ],
    };

    const endpointsResponse = {
      endpoints: [
        {
          id: 'ep-1',
          type: 'read_write',
          current_state: 'active',
          host: 'ep-main.neon.tech',
          autoscaling_limit_min_cu: 0.25,
          autoscaling_limit_max_cu: 2,
        },
      ],
    };

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => projectResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => branchesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => endpointsResponse });

    const result = await provider.fetch();
    expect(result).not.toBeNull();

    // Verify correct API endpoints called
    expect(mockFetch).toHaveBeenCalledTimes(3);

    const calls = mockFetch.mock.calls;
    expect(calls[0][0]).toBe(
      'https://console.neon.tech/api/v2/projects/neon-proj-123'
    );
    expect(calls[1][0]).toBe(
      'https://console.neon.tech/api/v2/projects/neon-proj-123/branches'
    );
    expect(calls[2][0]).toBe(
      'https://console.neon.tech/api/v2/projects/neon-proj-123/endpoints'
    );

    // Verify Authorization header
    for (const call of calls) {
      expect((call[1] as RequestInit).headers).toEqual({
        Authorization: 'Bearer test-neon-key',
      });
    }

    // Verify snapshot
    const snapshotData = result!.snapshot.data as Record<string, unknown>;
    expect((snapshotData.project as Record<string, unknown>).id).toBe('neon-proj-123');
    expect((snapshotData.project as Record<string, unknown>).name).toBe('my-neon-project');
    expect((snapshotData.project as Record<string, unknown>).regionId).toBe('aws-us-east-2');

    const branches = snapshotData.branches as Array<Record<string, unknown>>;
    expect(branches).toHaveLength(2);
    expect(branches[0].name).toBe('main');
    expect(branches[0].logicalSize).toBe(1024000);

    const endpoints = snapshotData.endpoints as Array<Record<string, unknown>>;
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].host).toBe('ep-main.neon.tech');
    expect(endpoints[0].type).toBe('read_write');
  });

  it('computes metrics from main branch data', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          project: { id: 'p', name: 'n', region_id: 'r', created_at: 'c' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          branches: [
            {
              id: 'br-1',
              name: 'main',
              logical_size: 5000000,
              written_data_bytes: 2500000,
              compute_time_seconds: 1800,
              current_state: 'ready',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ endpoints: [] }),
      });

    const result = await provider.fetch();

    const sizeMetric = result!.metrics.find(
      (m) => m.key === 'neon.db.size_bytes'
    );
    expect(sizeMetric!.value).toBe(5000000);
    expect(sizeMetric!.unit).toBe('bytes');

    const computeMetric = result!.metrics.find(
      (m) => m.key === 'neon.db.compute_seconds'
    );
    expect(computeMetric!.value).toBe(1800);
    expect(computeMetric!.unit).toBe('seconds');

    const writtenMetric = result!.metrics.find(
      (m) => m.key === 'neon.db.written_bytes'
    );
    expect(writtenMetric!.value).toBe(2500000);
    expect(writtenMetric!.unit).toBe('bytes');
  });

  it('handles missing main branch and falls back to first branch', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          project: { id: 'p', name: 'n', region_id: 'r', created_at: 'c' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          branches: [
            {
              id: 'br-dev',
              name: 'dev-branch',
              logical_size: 999,
              written_data_bytes: 444,
              compute_time_seconds: 111,
              current_state: 'ready',
            },
            {
              id: 'br-staging',
              name: 'staging',
              logical_size: 888,
              written_data_bytes: 333,
              compute_time_seconds: 222,
              current_state: 'ready',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ endpoints: [] }),
      });

    const result = await provider.fetch();
    expect(result).not.toBeNull();

    // Should use first branch (dev-branch) since no main/master
    const sizeMetric = result!.metrics.find(
      (m) => m.key === 'neon.db.size_bytes'
    );
    expect(sizeMetric!.value).toBe(999);

    const writtenMetric = result!.metrics.find(
      (m) => m.key === 'neon.db.written_bytes'
    );
    expect(writtenMetric!.value).toBe(444);

    const computeMetric = result!.metrics.find(
      (m) => m.key === 'neon.db.compute_seconds'
    );
    expect(computeMetric!.value).toBe(111);
  });

  it('finds master branch when main is not present', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          project: { id: 'p', name: 'n', region_id: 'r', created_at: 'c' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          branches: [
            {
              id: 'br-other',
              name: 'other',
              logical_size: 100,
              written_data_bytes: 50,
              compute_time_seconds: 10,
              current_state: 'ready',
            },
            {
              id: 'br-master',
              name: 'master',
              logical_size: 7777,
              written_data_bytes: 3333,
              compute_time_seconds: 555,
              current_state: 'ready',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ endpoints: [] }),
      });

    const result = await provider.fetch();
    expect(result).not.toBeNull();

    const sizeMetric = result!.metrics.find(
      (m) => m.key === 'neon.db.size_bytes'
    );
    expect(sizeMetric!.value).toBe(7777);
  });

  it('handles empty branches and uses zero defaults', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          project: { id: 'p', name: 'n', region_id: 'r', created_at: 'c' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ branches: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ endpoints: [] }),
      });

    const result = await provider.fetch();
    expect(result).not.toBeNull();

    // With no branches, mainBranch is undefined, metrics default to 0
    for (const metric of result!.metrics) {
      expect(metric.value).toBe(0);
    }
  });

  it('handles branch missing logical_size fields gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          project: { id: 'p', name: 'n', region_id: 'r', created_at: 'c' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          branches: [
            {
              id: 'br-1',
              name: 'main',
              current_state: 'ready',
              // No logical_size, written_data_bytes, or compute_time_seconds
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ endpoints: [] }),
      });

    const result = await provider.fetch();
    expect(result).not.toBeNull();

    for (const metric of result!.metrics) {
      expect(metric.value).toBe(0);
    }
  });

  it('handles non-ok response from Neon API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await provider.fetch();
    expect(result).toBeNull();
  });
});
