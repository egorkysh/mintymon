import { db } from './index';
import {
  providerCache,
  metricData,
  alertConfigs,
  alertHistory,
  providerConfigs,
  ingestionLog,
} from './schema';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';

// ─── Provider Cache ────────────────────────────────────────

export async function getProviderSnapshot(providerId: string) {
  const rows = await db
    .select()
    .from(providerCache)
    .where(eq(providerCache.providerId, providerId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertProviderSnapshot(
  providerId: string,
  data: Record<string, unknown>,
  fetchedAt: Date
) {
  await db
    .insert(providerCache)
    .values({ providerId, data, fetchedAt })
    .onConflictDoUpdate({
      target: providerCache.providerId,
      set: { data, fetchedAt, updatedAt: new Date() },
    });
}

// ─── Provider Configs ──────────────────────────────────────

export async function getProviderConfig(providerId: string) {
  const rows = await db
    .select()
    .from(providerConfigs)
    .where(eq(providerConfigs.providerId, providerId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertProviderConfig(
  providerId: string,
  name: string,
  intervalSeconds: number
) {
  await db
    .insert(providerConfigs)
    .values({ providerId, name, intervalSeconds })
    .onConflictDoUpdate({
      target: providerConfigs.providerId,
      set: { name, intervalSeconds, updatedAt: new Date() },
    });
}

export async function updateProviderFetchStatus(
  providerId: string,
  success: boolean
) {
  if (success) {
    await db
      .update(providerConfigs)
      .set({
        lastFetchAt: new Date(),
        lastSuccessAt: new Date(),
        consecutiveFailures: 0,
        updatedAt: new Date(),
      })
      .where(eq(providerConfigs.providerId, providerId));
  } else {
    await db
      .update(providerConfigs)
      .set({
        lastFetchAt: new Date(),
        consecutiveFailures: sql`${providerConfigs.consecutiveFailures} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(providerConfigs.providerId, providerId));
  }
}

// ─── Metric Data ───────────────────────────────────────────

export async function insertMetrics(
  metrics: Array<{
    metricKey: string;
    value: number;
    unit: string;
    tags?: Record<string, string>;
    timestamp: Date;
  }>
) {
  if (metrics.length === 0) return;
  await db.insert(metricData).values(metrics);
}

export async function getTimeseries(
  metricKey: string,
  from: Date,
  to: Date,
  limit = 1000
) {
  return db
    .select()
    .from(metricData)
    .where(
      and(
        eq(metricData.metricKey, metricKey),
        gte(metricData.timestamp, from),
        lte(metricData.timestamp, to)
      )
    )
    .orderBy(asc(metricData.timestamp))
    .limit(limit);
}

export async function getLatestMetricValue(metricKey: string) {
  const rows = await db
    .select()
    .from(metricData)
    .where(eq(metricData.metricKey, metricKey))
    .orderBy(desc(metricData.timestamp))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Alert Configs ─────────────────────────────────────────

export async function getEnabledAlertConfigs() {
  return db
    .select()
    .from(alertConfigs)
    .where(eq(alertConfigs.enabled, true));
}

export async function getAllAlertConfigs() {
  return db.select().from(alertConfigs).orderBy(desc(alertConfigs.createdAt));
}

export async function createAlertConfig(config: {
  name: string;
  metricKey: string;
  condition: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  consecutiveBreaches?: number;
  cooldownSeconds?: number;
  slackChannel?: string;
}) {
  const rows = await db.insert(alertConfigs).values(config).returning();
  return rows[0];
}

export async function updateAlertConfig(
  id: string,
  updates: Partial<{
    name: string;
    metricKey: string;
    condition: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
    threshold: number;
    consecutiveBreaches: number;
    cooldownSeconds: number;
    slackChannel: string;
    enabled: boolean;
  }>
) {
  await db
    .update(alertConfigs)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(alertConfigs.id, id));
}

export async function deleteAlertConfig(id: string) {
  await db.delete(alertConfigs).where(eq(alertConfigs.id, id));
}

// ─── Alert History ─────────────────────────────────────────

export async function insertAlertEvent(event: {
  alertConfigId: string;
  type: 'fired' | 'resolved';
  metricKey: string;
  metricValue: number;
  threshold: number;
  message?: string;
}) {
  await db.insert(alertHistory).values(event);
}

export async function getAlertHistory(limit = 100) {
  return db
    .select()
    .from(alertHistory)
    .orderBy(desc(alertHistory.createdAt))
    .limit(limit);
}

// ─── Ingestion Log ─────────────────────────────────────────

export async function logIngestion(entry: {
  providerId?: string;
  status: 'success' | 'error' | 'skipped';
  metricsCount?: number;
  durationMs?: number;
  error?: string;
}) {
  await db.insert(ingestionLog).values(entry);
}
