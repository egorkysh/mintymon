import { BaseProvider } from './base-provider';
import type { ProviderFetchResult, MetricDataPoint } from './types';

export class NeonProvider extends BaseProvider {
  readonly id = 'neon';
  readonly name = 'Neon Database';
  readonly minIntervalSeconds = 300;
  readonly metricKeys = [
    'neon.db.size_bytes',
    'neon.db.compute_seconds',
    'neon.db.written_bytes',
  ] as const;

  private async neonFetch(path: string) {
    const apiKey = process.env.NEON_API_KEY;
    if (!apiKey) throw new Error('NEON_API_KEY is required');

    const res = await fetch(`https://console.neon.tech/api/v2${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      throw new Error(`Neon API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  protected async doFetch(): Promise<ProviderFetchResult> {
    const projectId = process.env.NEON_PROJECT_ID;
    if (!projectId) throw new Error('NEON_PROJECT_ID is required');

    // Get project details
    const project = await this.neonFetch(`/projects/${projectId}`);

    // Get branches
    const branches = await this.neonFetch(`/projects/${projectId}/branches`);
    const mainBranch = branches.branches?.find(
      (b: { name: string }) => b.name === 'main' || b.name === 'master'
    ) ?? branches.branches?.[0];

    // Get endpoints
    const endpoints = await this.neonFetch(`/projects/${projectId}/endpoints`);

    const now = new Date();

    // Compute metrics from branch data
    const logicalSize = mainBranch?.logical_size ?? 0;
    const writtenBytes = mainBranch?.written_data_bytes ?? 0;
    const computeSeconds = mainBranch?.compute_time_seconds ?? 0;

    const snapshotData = {
      project: {
        id: project.project?.id,
        name: project.project?.name,
        regionId: project.project?.region_id,
        createdAt: project.project?.created_at,
      },
      branches: branches.branches?.map((b: Record<string, unknown>) => ({
        id: b.id,
        name: b.name,
        logicalSize: b.logical_size,
        writtenDataBytes: b.written_data_bytes,
        computeTimeSeconds: b.compute_time_seconds,
        currentState: b.current_state,
      })),
      endpoints: endpoints.endpoints?.map((e: Record<string, unknown>) => ({
        id: e.id,
        type: e.type,
        currentState: e.current_state,
        host: e.host,
        autoscalingLimitMinCu: e.autoscaling_limit_min_cu,
        autoscalingLimitMaxCu: e.autoscaling_limit_max_cu,
      })),
    };

    const metrics: MetricDataPoint[] = [
      {
        key: 'neon.db.size_bytes',
        value: logicalSize,
        unit: 'bytes',
        timestamp: now,
      },
      {
        key: 'neon.db.compute_seconds',
        value: computeSeconds,
        unit: 'seconds',
        timestamp: now,
      },
      {
        key: 'neon.db.written_bytes',
        value: writtenBytes,
        unit: 'bytes',
        timestamp: now,
      },
    ];

    return {
      snapshot: {
        providerId: this.id,
        data: snapshotData,
        fetchedAt: now,
      },
      metrics,
    };
  }
}
