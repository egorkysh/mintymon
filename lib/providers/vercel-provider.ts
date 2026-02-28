import { BaseProvider } from './base-provider';
import type { ProviderFetchResult, MetricDataPoint } from './types';

interface VercelDeployment {
  uid: string;
  name: string;
  state: string;
  url: string;
  created: number;
  ready?: number;
  buildingAt?: number;
  meta?: {
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitRef?: string;
  };
  target?: string;
}

export class VercelProvider extends BaseProvider {
  readonly id = 'vercel';
  readonly name = 'Vercel Deployments';
  readonly minIntervalSeconds = 60;
  readonly metricKeys = [
    'vercel.deployment.count_24h',
    'vercel.deployment.build_duration_ms',
    'vercel.deployment.success_rate',
  ] as const;

  protected async doFetch(): Promise<ProviderFetchResult> {
    const token = process.env.VERCEL_API_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;
    const teamId = process.env.VERCEL_TEAM_ID;

    if (!token || !projectId) {
      throw new Error('VERCEL_API_TOKEN and VERCEL_PROJECT_ID are required');
    }

    const params = new URLSearchParams({
      projectId,
      limit: '20',
      ...(teamId ? { teamId } : {}),
    });

    const res = await fetch(
      `https://api.vercel.com/v6/deployments?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      throw new Error(`Vercel API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const deployments: VercelDeployment[] = data.deployments ?? [];
    const now = new Date();

    // Last 10 for snapshot
    const snapshotDeployments = deployments.slice(0, 10).map((d) => ({
      uid: d.uid,
      name: d.name,
      state: d.state,
      url: d.url,
      created: d.created,
      ready: d.ready,
      buildingAt: d.buildingAt,
      commitSha: d.meta?.githubCommitSha,
      commitMessage: d.meta?.githubCommitMessage,
      commitRef: d.meta?.githubCommitRef,
      target: d.target,
    }));

    // Count deployments in the last 24 hours
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const last24h = deployments.filter((d) => d.created > dayAgo);

    // Calculate build durations (ready - buildingAt)
    const buildDurations = deployments
      .filter((d) => d.ready && d.buildingAt)
      .map((d) => d.ready! - d.buildingAt!);

    const avgBuildDuration =
      buildDurations.length > 0
        ? buildDurations.reduce((a, b) => a + b, 0) / buildDurations.length
        : 0;

    // Success rate
    const completedDeployments = last24h.filter(
      (d) => d.state === 'READY' || d.state === 'ERROR'
    );
    const successCount = completedDeployments.filter(
      (d) => d.state === 'READY'
    ).length;
    const successRate =
      completedDeployments.length > 0
        ? (successCount / completedDeployments.length) * 100
        : 100;

    const metrics: MetricDataPoint[] = [
      {
        key: 'vercel.deployment.count_24h',
        value: last24h.length,
        unit: 'count',
        timestamp: now,
      },
      {
        key: 'vercel.deployment.build_duration_ms',
        value: Math.round(avgBuildDuration),
        unit: 'ms',
        timestamp: now,
      },
      {
        key: 'vercel.deployment.success_rate',
        value: Math.round(successRate * 100) / 100,
        unit: 'percent',
        timestamp: now,
      },
    ];

    return {
      snapshot: {
        providerId: this.id,
        data: { deployments: snapshotDeployments },
        fetchedAt: now,
      },
      metrics,
    };
  }
}
