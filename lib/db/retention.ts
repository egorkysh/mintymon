import { db } from './index';
import { metricData, ingestionLog, alertHistory } from './schema';
import { lt } from 'drizzle-orm';

/** Purge metric data older than the specified number of days */
async function purgeOldMetrics(days = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  await db.delete(metricData).where(lt(metricData.createdAt, cutoff));
}

/** Purge ingestion logs older than the specified number of days */
async function purgeOldIngestionLogs(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  await db.delete(ingestionLog).where(lt(ingestionLog.createdAt, cutoff));
}

/** Purge alert history older than the specified number of days */
async function purgeOldAlertHistory(days = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  await db.delete(alertHistory).where(lt(alertHistory.createdAt, cutoff));
}

/** Run all retention cleanup tasks */
export async function runRetention() {
  await Promise.all([
    purgeOldMetrics(90),
    purgeOldIngestionLogs(30),
    purgeOldAlertHistory(90),
  ]);
}
