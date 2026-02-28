import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VercelProvider } from '../vercel-provider';

describe('VercelProvider', () => {
  let provider: VercelProvider;
  const originalEnv = { ...process.env };
  const mockFetch = vi.fn();

  beforeEach(() => {
    provider = new VercelProvider();
    process.env.VERCEL_API_TOKEN = 'test-token';
    process.env.VERCEL_PROJECT_ID = 'prj_123';
    process.env.VERCEL_TEAM_ID = 'team_456';
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('has correct provider metadata', () => {
    expect(provider.id).toBe('vercel');
    expect(provider.name).toBe('Vercel Deployments');
    expect(provider.minIntervalSeconds).toBe(60);
    expect(provider.metricKeys).toEqual([
      'vercel.deployment.count_24h',
      'vercel.deployment.build_duration_ms',
      'vercel.deployment.success_rate',
    ]);
  });

  it('throws when VERCEL_API_TOKEN is missing', async () => {
    delete process.env.VERCEL_API_TOKEN;
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await provider.fetch();
    // BaseProvider catches the throw, retries, then returns null
    expect(result).toBeNull();
  });

  it('throws when VERCEL_PROJECT_ID is missing', async () => {
    delete process.env.VERCEL_PROJECT_ID;
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await provider.fetch();
    expect(result).toBeNull();
  });

  it('parses deployment response correctly', async () => {
    const now = Date.now();
    const deployments = [
      {
        uid: 'dpl_1',
        name: 'my-app',
        state: 'READY',
        url: 'my-app-abc.vercel.app',
        created: now - 1000,
        ready: now - 500,
        buildingAt: now - 2000,
        meta: {
          githubCommitSha: 'abc123',
          githubCommitMessage: 'fix: bug',
          githubCommitRef: 'main',
        },
        target: 'production',
      },
      {
        uid: 'dpl_2',
        name: 'my-app',
        state: 'READY',
        url: 'my-app-def.vercel.app',
        created: now - 3000,
        ready: now - 2500,
        buildingAt: now - 4000,
        meta: {
          githubCommitSha: 'def456',
          githubCommitMessage: 'feat: new',
          githubCommitRef: 'dev',
        },
        target: 'preview',
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deployments }),
    });

    const result = await provider.fetch();

    expect(result).not.toBeNull();
    expect(result!.snapshot.providerId).toBe('vercel');

    const snapshotDeployments = (result!.snapshot.data.deployments as unknown[]);
    // Snapshot contains last 10 (here just 2)
    expect(snapshotDeployments).toHaveLength(2);

    // Verify snapshot fields are mapped correctly
    const first = snapshotDeployments[0] as Record<string, unknown>;
    expect(first.uid).toBe('dpl_1');
    expect(first.commitSha).toBe('abc123');
    expect(first.commitMessage).toBe('fix: bug');
    expect(first.commitRef).toBe('main');
    expect(first.target).toBe('production');

    // Metrics
    const metrics = result!.metrics;
    expect(metrics).toHaveLength(3);

    const countMetric = metrics.find(
      (m) => m.key === 'vercel.deployment.count_24h'
    );
    expect(countMetric).toBeDefined();
    expect(countMetric!.value).toBe(2); // Both within 24h
    expect(countMetric!.unit).toBe('count');

    const durationMetric = metrics.find(
      (m) => m.key === 'vercel.deployment.build_duration_ms'
    );
    expect(durationMetric).toBeDefined();
    // dpl_1: ready(-500) - buildingAt(-2000) = 1500ms
    // dpl_2: ready(-2500) - buildingAt(-4000) = 1500ms
    // avg = 1500
    expect(durationMetric!.value).toBe(1500);
    expect(durationMetric!.unit).toBe('ms');

    const successMetric = metrics.find(
      (m) => m.key === 'vercel.deployment.success_rate'
    );
    expect(successMetric).toBeDefined();
    expect(successMetric!.value).toBe(100);
    expect(successMetric!.unit).toBe('percent');
  });

  it('snapshot contains at most 10 deployments', async () => {
    const now = Date.now();
    const deployments = Array.from({ length: 15 }, (_, i) => ({
      uid: `dpl_${i}`,
      name: 'my-app',
      state: 'READY',
      url: `my-app-${i}.vercel.app`,
      created: now - i * 1000,
      ready: now - i * 1000 + 500,
      buildingAt: now - i * 1000 - 500,
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deployments }),
    });

    const result = await provider.fetch();
    const snapshotDeployments = result!.snapshot.data.deployments as unknown[];
    expect(snapshotDeployments).toHaveLength(10);
  });

  it('handles empty deployments array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deployments: [] }),
    });

    const result = await provider.fetch();

    expect(result).not.toBeNull();
    const snapshotDeployments = result!.snapshot.data.deployments as unknown[];
    expect(snapshotDeployments).toHaveLength(0);

    const countMetric = result!.metrics.find(
      (m) => m.key === 'vercel.deployment.count_24h'
    );
    expect(countMetric!.value).toBe(0);

    const durationMetric = result!.metrics.find(
      (m) => m.key === 'vercel.deployment.build_duration_ms'
    );
    expect(durationMetric!.value).toBe(0);

    // No completed deployments -> success rate defaults to 100
    const successMetric = result!.metrics.find(
      (m) => m.key === 'vercel.deployment.success_rate'
    );
    expect(successMetric!.value).toBe(100);
  });

  it('handles deployments missing ready and buildingAt', async () => {
    const now = Date.now();
    const deployments = [
      {
        uid: 'dpl_1',
        name: 'my-app',
        state: 'BUILDING',
        url: 'my-app-abc.vercel.app',
        created: now - 1000,
        // No ready, no buildingAt
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deployments }),
    });

    const result = await provider.fetch();
    expect(result).not.toBeNull();

    // No valid build durations
    const durationMetric = result!.metrics.find(
      (m) => m.key === 'vercel.deployment.build_duration_ms'
    );
    expect(durationMetric!.value).toBe(0);
  });

  it('computes success rate with mixed READY and ERROR states', async () => {
    const now = Date.now();
    const deployments = [
      { uid: 'dpl_1', name: 'a', state: 'READY', url: 'u', created: now - 100 },
      { uid: 'dpl_2', name: 'a', state: 'READY', url: 'u', created: now - 200 },
      { uid: 'dpl_3', name: 'a', state: 'ERROR', url: 'u', created: now - 300 },
      { uid: 'dpl_4', name: 'a', state: 'READY', url: 'u', created: now - 400 },
      { uid: 'dpl_5', name: 'a', state: 'ERROR', url: 'u', created: now - 500 },
      // BUILDING should not count toward success rate
      { uid: 'dpl_6', name: 'a', state: 'BUILDING', url: 'u', created: now - 600 },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deployments }),
    });

    const result = await provider.fetch();

    const successMetric = result!.metrics.find(
      (m) => m.key === 'vercel.deployment.success_rate'
    );
    // 3 READY out of 5 completed (READY + ERROR) = 60%
    expect(successMetric!.value).toBe(60);
  });

  it('includes teamId in request params when set', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deployments: [] }),
    });

    await provider.fetch();

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('teamId=team_456');
    expect(calledUrl).toContain('projectId=prj_123');
    expect(calledUrl).toContain('limit=20');
  });

  it('omits teamId from request when not set', async () => {
    delete process.env.VERCEL_TEAM_ID;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deployments: [] }),
    });

    await provider.fetch();

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('teamId');
  });

  it('sends correct Authorization header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deployments: [] }),
    });

    await provider.fetch();

    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect((calledOptions.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-token'
    );
  });

  it('handles non-ok response from Vercel API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await provider.fetch();
    expect(result).toBeNull();
  });

  it('handles undefined deployments field in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}), // no deployments field at all
    });

    const result = await provider.fetch();
    expect(result).not.toBeNull();
    const snapshotDeployments = result!.snapshot.data.deployments as unknown[];
    expect(snapshotDeployments).toHaveLength(0);
  });
});
