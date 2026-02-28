import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// ─── Helpers ──────────────────────────────────────────────

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function jitter(base: number, pct = 0.15): number {
  return base * (1 + (Math.random() * 2 - 1) * pct);
}

// ─── Provider Configs ─────────────────────────────────────

async function seedProviderConfigs() {
  const providers = [
    { providerId: 'vercel', name: 'Vercel Deployments', intervalSeconds: 60 },
    { providerId: 'neon', name: 'Neon Database', intervalSeconds: 300 },
    { providerId: 'axiom', name: 'Axiom Latency', intervalSeconds: 60 },
  ];

  for (const p of providers) {
    await db
      .insert(schema.providerConfigs)
      .values({
        providerId: p.providerId,
        name: p.name,
        enabled: true,
        intervalSeconds: p.intervalSeconds,
        lastFetchAt: hoursAgo(0),
        lastSuccessAt: hoursAgo(0),
        consecutiveFailures: 0,
        config: {},
      })
      .onConflictDoNothing();
  }
}

// ─── Provider Cache (latest snapshots) ────────────────────

async function seedProviderCache() {
  const vercelSnapshot = {
    deployments: [
      { uid: 'dpl_abc1', state: 'READY', name: 'mintymon', url: 'mintymon-abc1.vercel.app', created: hoursAgo(0.5).toISOString(), buildingAt: hoursAgo(0.6).toISOString(), ready: hoursAgo(0.5).toISOString(), meta: { githubCommitMessage: 'fix: resolve dashboard loading state', githubCommitRef: 'main' }, target: 'production' },
      { uid: 'dpl_abc2', state: 'READY', name: 'mintymon', url: 'mintymon-abc2.vercel.app', created: hoursAgo(2).toISOString(), buildingAt: hoursAgo(2.1).toISOString(), ready: hoursAgo(2).toISOString(), meta: { githubCommitMessage: 'feat: add alert cooldown support', githubCommitRef: 'main' }, target: 'production' },
      { uid: 'dpl_abc3', state: 'READY', name: 'mintymon', url: 'mintymon-abc3.vercel.app', created: hoursAgo(5).toISOString(), buildingAt: hoursAgo(5.1).toISOString(), ready: hoursAgo(5).toISOString(), meta: { githubCommitMessage: 'chore: update dependencies', githubCommitRef: 'main' }, target: 'production' },
      { uid: 'dpl_abc4', state: 'ERROR', name: 'mintymon', url: 'mintymon-abc4.vercel.app', created: hoursAgo(8).toISOString(), buildingAt: hoursAgo(8.1).toISOString(), meta: { githubCommitMessage: 'wip: experimental chart component', githubCommitRef: 'feat/charts' }, target: 'preview' },
      { uid: 'dpl_abc5', state: 'READY', name: 'mintymon', url: 'mintymon-abc5.vercel.app', created: hoursAgo(10).toISOString(), buildingAt: hoursAgo(10.1).toISOString(), ready: hoursAgo(10).toISOString(), meta: { githubCommitMessage: 'feat: monitoring dashboard MVP', githubCommitRef: 'main' }, target: 'production' },
      { uid: 'dpl_abc6', state: 'READY', name: 'mintymon', url: 'mintymon-abc6.vercel.app', created: hoursAgo(14).toISOString(), buildingAt: hoursAgo(14.1).toISOString(), ready: hoursAgo(14).toISOString(), meta: { githubCommitMessage: 'fix: auth session cookie secure flag', githubCommitRef: 'main' }, target: 'production' },
      { uid: 'dpl_abc7', state: 'READY', name: 'mintymon', url: 'mintymon-abc7.vercel.app', created: hoursAgo(20).toISOString(), buildingAt: hoursAgo(20.1).toISOString(), ready: hoursAgo(20).toISOString(), meta: { githubCommitMessage: 'feat: add neon provider integration', githubCommitRef: 'main' }, target: 'production' },
      { uid: 'dpl_abc8', state: 'READY', name: 'mintymon', url: 'mintymon-abc8.vercel.app', created: hoursAgo(22).toISOString(), buildingAt: hoursAgo(22.1).toISOString(), ready: hoursAgo(22).toISOString(), meta: { githubCommitMessage: 'refactor: extract provider registry', githubCommitRef: 'main' }, target: 'production' },
      { uid: 'dpl_abc9', state: 'BUILDING', name: 'mintymon', url: 'mintymon-abc9.vercel.app', created: hoursAgo(0.05).toISOString(), buildingAt: hoursAgo(0.05).toISOString(), meta: { githubCommitMessage: 'feat: add seed script for dev data', githubCommitRef: 'feat/seed' }, target: 'preview' },
      { uid: 'dpl_abc10', state: 'READY', name: 'mintymon', url: 'mintymon-abc10.vercel.app', created: hoursAgo(24).toISOString(), buildingAt: hoursAgo(24.1).toISOString(), ready: hoursAgo(24).toISOString(), meta: { githubCommitMessage: 'init: project scaffolding', githubCommitRef: 'main' }, target: 'production' },
    ],
  };

  const neonSnapshot = {
    project: {
      id: 'dry-violet-37248712',
      name: 'mintymon',
      region_id: 'aws-eu-central-1',
      pg_version: 17,
      created_at: hoursAgo(168).toISOString(),
    },
    branches: [
      { id: 'br-main-001', name: 'main', primary: true, logical_size: 28_450_816 },
      { id: 'br-dev-002', name: 'dev', primary: false, logical_size: 28_450_816 },
    ],
    endpoints: [
      { id: 'ep-main-001', type: 'read_write', host: 'ep-cool-meadow.c-2.eu-central-1.aws.neon.tech', current_state: 'active', autoscaling_limit_min_cu: 0.25, autoscaling_limit_max_cu: 8 },
      { id: 'ep-dev-002', type: 'read_write', host: 'ep-lucky-breeze.c-2.eu-central-1.aws.neon.tech', current_state: 'active', autoscaling_limit_min_cu: 0.25, autoscaling_limit_max_cu: 8 },
    ],
  };

  const axiomSnapshot = {
    totals: { count: 14832, min_ts: hoursAgo(1).toISOString(), max_ts: hoursAgo(0).toISOString() },
    buckets: [],
  };

  const snapshots = [
    { providerId: 'vercel', data: vercelSnapshot },
    { providerId: 'neon', data: neonSnapshot },
    { providerId: 'axiom', data: axiomSnapshot },
  ];

  for (const s of snapshots) {
    await db
      .insert(schema.providerCache)
      .values({
        providerId: s.providerId,
        data: s.data,
        fetchedAt: hoursAgo(0),
      })
      .onConflictDoNothing();
  }
}

// ─── Metric Data (24h time-series) ────────────────────────

async function seedMetrics() {
  const rows: schema.NewMetricDataRow[] = [];
  const pointCount = 96; // every 15 min for 24h

  for (let i = pointCount; i >= 0; i--) {
    const ts = new Date(Date.now() - i * 15 * 60 * 1000);

    // Vercel metrics
    rows.push(
      { metricKey: 'vercel.deployment.count_24h', value: Math.floor(jitter(8, 0.3)), unit: 'count', tags: {}, timestamp: ts },
      { metricKey: 'vercel.deployment.build_duration_ms', value: Math.floor(jitter(42_000, 0.2)), unit: 'ms', tags: {}, timestamp: ts },
      { metricKey: 'vercel.deployment.success_rate', value: Math.min(100, jitter(96, 0.04)), unit: 'percent', tags: {}, timestamp: ts },
    );

    // Neon metrics
    rows.push(
      { metricKey: 'neon.db.size_bytes', value: jitter(28_450_816, 0.02), unit: 'bytes', tags: {}, timestamp: ts },
      { metricKey: 'neon.db.compute_seconds', value: jitter(145, 0.1), unit: 'seconds', tags: {}, timestamp: ts },
      { metricKey: 'neon.db.written_bytes', value: jitter(5_200_000, 0.25), unit: 'bytes', tags: {}, timestamp: ts },
    );

    // Axiom metrics — simulate a brief latency spike around 6h ago
    const isSpike = i >= 68 && i <= 74;
    const spikeMultiplier = isSpike ? 2.5 : 1;

    rows.push(
      { metricKey: 'axiom.latency.p50', value: jitter(45 * spikeMultiplier, 0.15), unit: 'ms', tags: {}, timestamp: ts },
      { metricKey: 'axiom.latency.p95', value: jitter(180 * spikeMultiplier, 0.15), unit: 'ms', tags: {}, timestamp: ts },
      { metricKey: 'axiom.latency.p99', value: jitter(320 * spikeMultiplier, 0.15), unit: 'ms', tags: {}, timestamp: ts },
      { metricKey: 'axiom.requests.total', value: Math.floor(jitter(14_800, 0.1)), unit: 'count', tags: {}, timestamp: ts },
      { metricKey: 'axiom.requests.error_rate', value: isSpike ? jitter(3.2, 0.3) : jitter(0.4, 0.5), unit: 'percent', tags: {}, timestamp: ts },
    );
  }

  // Insert in batches of 200
  for (let i = 0; i < rows.length; i += 200) {
    await db.insert(schema.metricData).values(rows.slice(i, i + 200));
  }
}

// ─── Alert Configs & History ──────────────────────────────

async function seedAlerts() {
  const alerts = await db
    .insert(schema.alertConfigs)
    .values([
      {
        name: 'High P95 Latency',
        metricKey: 'axiom.latency.p95',
        condition: 'gt',
        threshold: 500,
        consecutiveBreaches: 3,
        cooldownSeconds: 600,
        slackChannel: '#alerts-prod',
        enabled: true,
        currentBreachCount: 0,
      },
      {
        name: 'Error Rate Critical',
        metricKey: 'axiom.requests.error_rate',
        condition: 'gt',
        threshold: 5,
        consecutiveBreaches: 2,
        cooldownSeconds: 300,
        slackChannel: '#alerts-prod',
        enabled: true,
        currentBreachCount: 0,
      },
      {
        name: 'Deployment Failures',
        metricKey: 'vercel.deployment.success_rate',
        condition: 'lt',
        threshold: 90,
        consecutiveBreaches: 1,
        cooldownSeconds: 900,
        slackChannel: '#deployments',
        enabled: true,
        currentBreachCount: 0,
      },
      {
        name: 'Database Size Warning',
        metricKey: 'neon.db.size_bytes',
        condition: 'gt',
        threshold: 100_000_000,
        consecutiveBreaches: 1,
        cooldownSeconds: 3600,
        enabled: false,
        currentBreachCount: 0,
      },
    ])
    .returning();

  // Simulate the latency spike alert firing and resolving
  const latencyAlert = alerts[0];
  await db.insert(schema.alertHistory).values([
    {
      alertConfigId: latencyAlert.id,
      type: 'fired',
      metricKey: 'axiom.latency.p95',
      metricValue: 462,
      threshold: 500,
      message: 'P95 latency exceeded 500ms for 3 consecutive checks (462ms)',
      createdAt: hoursAgo(6),
    },
    {
      alertConfigId: latencyAlert.id,
      type: 'resolved',
      metricKey: 'axiom.latency.p95',
      metricValue: 175,
      threshold: 500,
      message: 'P95 latency returned below 500ms (175ms)',
      createdAt: hoursAgo(4.5),
    },
  ]);
}

// ─── Ingestion Log ────────────────────────────────────────

async function seedIngestionLog() {
  const rows = [];

  for (let i = 24; i >= 0; i--) {
    for (const providerId of ['vercel', 'neon', 'axiom']) {
      const isFailed = providerId === 'axiom' && i === 12;
      rows.push({
        providerId,
        status: isFailed ? ('error' as const) : ('success' as const),
        metricsCount: isFailed ? 0 : providerId === 'vercel' ? 3 : providerId === 'neon' ? 3 : 5,
        durationMs: Math.floor(jitter(providerId === 'neon' ? 800 : 350, 0.3)),
        error: isFailed ? 'Axiom API timeout after 10000ms' : null,
        createdAt: hoursAgo(i),
      });
    }
  }

  for (let i = 0; i < rows.length; i += 50) {
    await db.insert(schema.ingestionLog).values(rows.slice(i, i + 50));
  }
}

// ─── Run ──────────────────────────────────────────────────

async function main() {
  console.warn('Seeding dev database...');
  await seedProviderConfigs();
  await seedProviderCache();
  await seedMetrics();
  await seedAlerts();
  await seedIngestionLog();
  console.warn('Done! Dev database seeded with realistic data.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
