import {
  getEnabledAlertConfigs,
  getLatestMetricValue,
  insertAlertEvent,
} from '@/lib/db/queries';
import { alertConfigs } from '@/lib/db/schema';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { sendSlackAlert } from './slack';

function evaluateCondition(
  condition: string,
  value: number,
  threshold: number
): boolean {
  switch (condition) {
    case 'gt': return value > threshold;
    case 'lt': return value < threshold;
    case 'gte': return value >= threshold;
    case 'lte': return value <= threshold;
    case 'eq': return value === threshold;
    default: return false;
  }
}

export async function evaluateAlerts() {
  const configs = await getEnabledAlertConfigs();

  for (const config of configs) {
    const latest = await getLatestMetricValue(config.metricKey);
    if (!latest) continue;

    const breached = evaluateCondition(
      config.condition,
      latest.value,
      config.threshold
    );

    if (breached) {
      // Increment breach count
      const newBreachCount = config.currentBreachCount + 1;
      await db
        .update(alertConfigs)
        .set({ currentBreachCount: newBreachCount, updatedAt: new Date() })
        .where(eq(alertConfigs.id, config.id));

      // Check if consecutive breaches threshold is met
      if (newBreachCount >= config.consecutiveBreaches) {
        // Check cooldown
        if (config.lastFiredAt) {
          const elapsed = (Date.now() - config.lastFiredAt.getTime()) / 1000;
          if (elapsed < config.cooldownSeconds) continue;
        }

        // Fire alert
        const message = `Alert: ${config.name} — ${config.metricKey} is ${latest.value} (threshold: ${config.condition} ${config.threshold})`;

        await insertAlertEvent({
          alertConfigId: config.id,
          type: 'fired',
          metricKey: config.metricKey,
          metricValue: latest.value,
          threshold: config.threshold,
          message,
        });

        await db
          .update(alertConfigs)
          .set({ lastFiredAt: new Date(), updatedAt: new Date() })
          .where(eq(alertConfigs.id, config.id));

        await sendSlackAlert({
          text: message,
          color: 'danger',
          fields: [
            { title: 'Metric', value: config.metricKey, short: true },
            { title: 'Value', value: String(latest.value), short: true },
            { title: 'Threshold', value: `${config.condition} ${config.threshold}`, short: true },
            { title: 'Breaches', value: String(newBreachCount), short: true },
          ],
          channel: config.slackChannel ?? undefined,
        });
      }
    } else {
      // Metric is back to normal
      if (config.currentBreachCount > 0) {
        // Reset breach count
        await db
          .update(alertConfigs)
          .set({ currentBreachCount: 0, updatedAt: new Date() })
          .where(eq(alertConfigs.id, config.id));

        // If the alert was previously fired, send resolution
        if (config.lastFiredAt) {
          const message = `Resolved: ${config.name} — ${config.metricKey} is now ${latest.value}`;

          await insertAlertEvent({
            alertConfigId: config.id,
            type: 'resolved',
            metricKey: config.metricKey,
            metricValue: latest.value,
            threshold: config.threshold,
            message,
          });

          await sendSlackAlert({
            text: message,
            color: 'good',
            fields: [
              { title: 'Metric', value: config.metricKey, short: true },
              { title: 'Value', value: String(latest.value), short: true },
            ],
            channel: config.slackChannel ?? undefined,
          });
        }
      }
    }
  }
}
