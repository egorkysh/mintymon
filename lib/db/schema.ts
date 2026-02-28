import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  real,
  index,
} from 'drizzle-orm/pg-core';

// ─── Provider Configs ──────────────────────────────────────
// Settings for each provider: enabled, interval, last fetch, failure count

export const providerConfigs = pgTable('provider_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: text('provider_id').notNull().unique(),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  intervalSeconds: integer('interval_seconds').notNull().default(60),
  lastFetchAt: timestamp('last_fetch_at'),
  lastSuccessAt: timestamp('last_success_at'),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  config: jsonb('config').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── Provider Cache ────────────────────────────────────────
// Latest snapshot per provider (JSONB, upserted each cycle)

export const providerCache = pgTable('provider_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: text('provider_id').notNull().unique(),
  data: jsonb('data').notNull().$type<Record<string, unknown>>(),
  fetchedAt: timestamp('fetched_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── Metric Data ───────────────────────────────────────────
// Time-series metrics (key + value + unit + tags + timestamp)

export const metricData = pgTable('metric_data', {
  id: uuid('id').defaultRandom().primaryKey(),
  metricKey: text('metric_key').notNull(),
  value: real('value').notNull(),
  unit: text('unit').notNull(),
  tags: jsonb('tags').$type<Record<string, string>>().default({}),
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('metric_data_key_timestamp_idx').on(table.metricKey, table.timestamp),
  index('metric_data_created_at_idx').on(table.createdAt),
]);

// ─── Alert Configs ─────────────────────────────────────────
// Alert rules: metric key, condition, threshold, cooldown, Slack channel

export const alertConfigs = pgTable('alert_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  metricKey: text('metric_key').notNull(),
  condition: text('condition').notNull().$type<'gt' | 'lt' | 'gte' | 'lte' | 'eq'>(),
  threshold: real('threshold').notNull(),
  consecutiveBreaches: integer('consecutive_breaches').notNull().default(1),
  cooldownSeconds: integer('cooldown_seconds').notNull().default(300),
  slackChannel: text('slack_channel'),
  enabled: boolean('enabled').notNull().default(true),
  currentBreachCount: integer('current_breach_count').notNull().default(0),
  lastFiredAt: timestamp('last_fired_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── Alert History ─────────────────────────────────────────
// Fired/resolved alerts with timestamps

export const alertHistory = pgTable('alert_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  alertConfigId: uuid('alert_config_id').references(() => alertConfigs.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull().$type<'fired' | 'resolved'>(),
  metricKey: text('metric_key').notNull(),
  metricValue: real('metric_value').notNull(),
  threshold: real('threshold').notNull(),
  message: text('message'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('alert_history_config_id_idx').on(table.alertConfigId),
  index('alert_history_created_at_idx').on(table.createdAt),
]);

// ─── Ingestion Log ─────────────────────────────────────────
// Debug log of each cron execution

export const ingestionLog = pgTable('ingestion_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: text('provider_id'),
  status: text('status').notNull().$type<'success' | 'error' | 'skipped'>(),
  metricsCount: integer('metrics_count').default(0),
  durationMs: integer('duration_ms'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('ingestion_log_created_at_idx').on(table.createdAt),
]);

// ─── Type Exports ──────────────────────────────────────────

export type ProviderConfig = typeof providerConfigs.$inferSelect;
export type NewProviderConfig = typeof providerConfigs.$inferInsert;

export type ProviderCacheRow = typeof providerCache.$inferSelect;

export type MetricDataRow = typeof metricData.$inferSelect;
export type NewMetricDataRow = typeof metricData.$inferInsert;

export type AlertConfig = typeof alertConfigs.$inferSelect;
export type NewAlertConfig = typeof alertConfigs.$inferInsert;

export type AlertHistoryRow = typeof alertHistory.$inferSelect;

export type IngestionLogRow = typeof ingestionLog.$inferSelect;
