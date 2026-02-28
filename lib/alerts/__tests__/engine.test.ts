import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────

const mockGetEnabledAlertConfigs = vi.fn();
const mockGetLatestMetricValue = vi.fn();
const mockInsertAlertEvent = vi.fn();

vi.mock('@/lib/db/queries', () => ({
  getEnabledAlertConfigs: (...args: unknown[]) => mockGetEnabledAlertConfigs(...args),
  getLatestMetricValue: (...args: unknown[]) => mockGetLatestMetricValue(...args),
  insertAlertEvent: (...args: unknown[]) => mockInsertAlertEvent(...args),
}));

const mockWhere = vi.fn().mockResolvedValue(undefined);
const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

vi.mock('@/lib/db', () => ({
  db: {
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  alertConfigs: {
    id: 'alertConfigs.id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}));

const mockSendSlackAlert = vi.fn();

vi.mock('../slack', () => ({
  sendSlackAlert: (...args: unknown[]) => mockSendSlackAlert(...args),
}));

// ── Import after mocks ──────────────────────────────────────

import { evaluateAlerts } from '../engine';

// ── Helpers ─────────────────────────────────────────────────

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cfg-1',
    name: 'CPU High',
    metricKey: 'cpu.usage',
    condition: 'gt',
    threshold: 90,
    consecutiveBreaches: 3,
    cooldownSeconds: 300,
    slackChannel: null,
    enabled: true,
    currentBreachCount: 0,
    lastFiredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMetric(value: number) {
  return { value };
}

// ── Tests ───────────────────────────────────────────────────

describe('evaluateAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the chain mocks so each test starts clean
    mockWhere.mockResolvedValue(undefined);
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  // ── No configs ──────────────────────────────────────────

  it('does nothing when there are no enabled configs', async () => {
    mockGetEnabledAlertConfigs.mockResolvedValue([]);

    await evaluateAlerts();

    expect(mockGetLatestMetricValue).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsertAlertEvent).not.toHaveBeenCalled();
    expect(mockSendSlackAlert).not.toHaveBeenCalled();
  });

  // ── No metric data ──────────────────────────────────────

  it('skips config when no metric data is available', async () => {
    mockGetEnabledAlertConfigs.mockResolvedValue([makeConfig()]);
    mockGetLatestMetricValue.mockResolvedValue(null);

    await evaluateAlerts();

    expect(mockGetLatestMetricValue).toHaveBeenCalledWith('cpu.usage');
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsertAlertEvent).not.toHaveBeenCalled();
    expect(mockSendSlackAlert).not.toHaveBeenCalled();
  });

  // ── Condition: gt ───────────────────────────────────────

  it('increments breach count when condition "gt" is met', async () => {
    mockGetEnabledAlertConfigs.mockResolvedValue([
      makeConfig({ condition: 'gt', threshold: 90, currentBreachCount: 0, consecutiveBreaches: 5 }),
    ]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(95));

    await evaluateAlerts();

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentBreachCount: 1 }),
    );
  });

  it('does NOT breach when value equals threshold for "gt"', async () => {
    mockGetEnabledAlertConfigs.mockResolvedValue([
      makeConfig({ condition: 'gt', threshold: 90, currentBreachCount: 0 }),
    ]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(90));

    await evaluateAlerts();

    // No breach => enters "else" branch, but currentBreachCount is 0 so nothing happens
    expect(mockInsertAlertEvent).not.toHaveBeenCalled();
    expect(mockSendSlackAlert).not.toHaveBeenCalled();
  });

  // ── Condition: lt ───────────────────────────────────────

  it('increments breach count when condition "lt" is met', async () => {
    mockGetEnabledAlertConfigs.mockResolvedValue([
      makeConfig({ condition: 'lt', threshold: 10, currentBreachCount: 0, consecutiveBreaches: 5 }),
    ]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(5));

    await evaluateAlerts();

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentBreachCount: 1 }),
    );
  });

  // ── Condition: gte ──────────────────────────────────────

  it('increments breach count when condition "gte" is met (equal)', async () => {
    mockGetEnabledAlertConfigs.mockResolvedValue([
      makeConfig({ condition: 'gte', threshold: 90, currentBreachCount: 0, consecutiveBreaches: 5 }),
    ]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(90));

    await evaluateAlerts();

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentBreachCount: 1 }),
    );
  });

  it('increments breach count when condition "gte" is met (greater)', async () => {
    mockGetEnabledAlertConfigs.mockResolvedValue([
      makeConfig({ condition: 'gte', threshold: 90, currentBreachCount: 0, consecutiveBreaches: 5 }),
    ]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(95));

    await evaluateAlerts();

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentBreachCount: 1 }),
    );
  });

  // ── Condition: lte ──────────────────────────────────────

  it('increments breach count when condition "lte" is met (equal)', async () => {
    mockGetEnabledAlertConfigs.mockResolvedValue([
      makeConfig({ condition: 'lte', threshold: 10, currentBreachCount: 0, consecutiveBreaches: 5 }),
    ]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(10));

    await evaluateAlerts();

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentBreachCount: 1 }),
    );
  });

  it('increments breach count when condition "lte" is met (less)', async () => {
    mockGetEnabledAlertConfigs.mockResolvedValue([
      makeConfig({ condition: 'lte', threshold: 10, currentBreachCount: 0, consecutiveBreaches: 5 }),
    ]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(5));

    await evaluateAlerts();

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentBreachCount: 1 }),
    );
  });

  // ── Condition: eq ───────────────────────────────────────

  it('increments breach count when condition "eq" is met', async () => {
    mockGetEnabledAlertConfigs.mockResolvedValue([
      makeConfig({ condition: 'eq', threshold: 42, currentBreachCount: 0, consecutiveBreaches: 5 }),
    ]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(42));

    await evaluateAlerts();

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentBreachCount: 1 }),
    );
  });

  it('does NOT breach when value differs for "eq"', async () => {
    mockGetEnabledAlertConfigs.mockResolvedValue([
      makeConfig({ condition: 'eq', threshold: 42, currentBreachCount: 0 }),
    ]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(43));

    await evaluateAlerts();

    expect(mockInsertAlertEvent).not.toHaveBeenCalled();
    expect(mockSendSlackAlert).not.toHaveBeenCalled();
  });

  // ── Unknown condition ───────────────────────────────────

  it('does not breach for an unknown condition', async () => {
    mockGetEnabledAlertConfigs.mockResolvedValue([
      makeConfig({ condition: 'unknown', threshold: 50, currentBreachCount: 0 }),
    ]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(50));

    await evaluateAlerts();

    // unknown condition => evaluateCondition returns false => else branch
    // currentBreachCount is 0, so nothing happens
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsertAlertEvent).not.toHaveBeenCalled();
    expect(mockSendSlackAlert).not.toHaveBeenCalled();
  });

  // ── Fires alert when consecutive breaches threshold is reached + no cooldown ──

  it('fires alert when consecutive breaches threshold is reached and no previous firing', async () => {
    const config = makeConfig({
      currentBreachCount: 2,
      consecutiveBreaches: 3,
      lastFiredAt: null,
    });
    mockGetEnabledAlertConfigs.mockResolvedValue([config]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(95));

    await evaluateAlerts();

    // First call: increment breach count
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentBreachCount: 3 }),
    );

    // Should insert a 'fired' event
    expect(mockInsertAlertEvent).toHaveBeenCalledWith({
      alertConfigId: 'cfg-1',
      type: 'fired',
      metricKey: 'cpu.usage',
      metricValue: 95,
      threshold: 90,
      message: 'Alert: CPU High — cpu.usage is 95 (threshold: gt 90)',
    });

    // Should update lastFiredAt
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastFiredAt: expect.any(Date) }),
    );

    // Should send Slack alert
    expect(mockSendSlackAlert).toHaveBeenCalledWith({
      text: 'Alert: CPU High — cpu.usage is 95 (threshold: gt 90)',
      color: 'danger',
      fields: [
        { title: 'Metric', value: 'cpu.usage', short: true },
        { title: 'Value', value: '95', short: true },
        { title: 'Threshold', value: 'gt 90', short: true },
        { title: 'Breaches', value: '3', short: true },
      ],
      channel: undefined,
    });
  });

  // ── Fires alert when cooldown has elapsed ─────────────

  it('fires alert when cooldown has elapsed', async () => {
    const pastFiring = new Date('2026-01-15T11:50:00Z'); // 10 minutes ago
    const config = makeConfig({
      currentBreachCount: 2,
      consecutiveBreaches: 3,
      cooldownSeconds: 300, // 5 minutes
      lastFiredAt: pastFiring,
    });
    mockGetEnabledAlertConfigs.mockResolvedValue([config]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(95));

    await evaluateAlerts();

    // 600 seconds elapsed > 300 cooldown => should fire
    expect(mockInsertAlertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fired' }),
    );
    expect(mockSendSlackAlert).toHaveBeenCalled();
  });

  // ── Skips firing when cooldown has NOT elapsed ────────

  it('skips firing when cooldown has not elapsed', async () => {
    const recentFiring = new Date('2026-01-15T11:58:00Z'); // 2 minutes ago
    const config = makeConfig({
      currentBreachCount: 2,
      consecutiveBreaches: 3,
      cooldownSeconds: 300, // 5 minutes
      lastFiredAt: recentFiring,
    });
    mockGetEnabledAlertConfigs.mockResolvedValue([config]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(95));

    await evaluateAlerts();

    // 120 seconds elapsed < 300 cooldown => should increment but NOT fire
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentBreachCount: 3 }),
    );
    expect(mockInsertAlertEvent).not.toHaveBeenCalled();
    expect(mockSendSlackAlert).not.toHaveBeenCalled();
  });

  // ── Below threshold → breach count not yet met ────────

  it('increments breach count but does not fire when threshold not yet reached', async () => {
    const config = makeConfig({
      currentBreachCount: 0,
      consecutiveBreaches: 3,
    });
    mockGetEnabledAlertConfigs.mockResolvedValue([config]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(95));

    await evaluateAlerts();

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentBreachCount: 1 }),
    );
    expect(mockInsertAlertEvent).not.toHaveBeenCalled();
    expect(mockSendSlackAlert).not.toHaveBeenCalled();
  });

  // ── Metric returns to normal → resets breach count ────

  it('resets breach count when metric returns to normal', async () => {
    const config = makeConfig({
      currentBreachCount: 2,
      consecutiveBreaches: 3,
      lastFiredAt: null,
    });
    mockGetEnabledAlertConfigs.mockResolvedValue([config]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(50)); // below threshold

    await evaluateAlerts();

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentBreachCount: 0 }),
    );
    // No resolution since lastFiredAt is null
    expect(mockInsertAlertEvent).not.toHaveBeenCalled();
    expect(mockSendSlackAlert).not.toHaveBeenCalled();
  });

  // ── Metric returns to normal with lastFiredAt set → sends resolution ──

  it('sends resolution event and Slack notification when metric returns to normal after firing', async () => {
    const config = makeConfig({
      currentBreachCount: 2,
      consecutiveBreaches: 3,
      lastFiredAt: new Date('2026-01-15T11:00:00Z'),
    });
    mockGetEnabledAlertConfigs.mockResolvedValue([config]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(50));

    await evaluateAlerts();

    // Reset breach count
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentBreachCount: 0 }),
    );

    // Insert resolved event
    expect(mockInsertAlertEvent).toHaveBeenCalledWith({
      alertConfigId: 'cfg-1',
      type: 'resolved',
      metricKey: 'cpu.usage',
      metricValue: 50,
      threshold: 90,
      message: 'Resolved: CPU High — cpu.usage is now 50',
    });

    // Send Slack resolution
    expect(mockSendSlackAlert).toHaveBeenCalledWith({
      text: 'Resolved: CPU High — cpu.usage is now 50',
      color: 'good',
      fields: [
        { title: 'Metric', value: 'cpu.usage', short: true },
        { title: 'Value', value: '50', short: true },
      ],
      channel: undefined,
    });
  });

  // ── Metric returns to normal with lastFiredAt null → no resolution ──

  it('does not send resolution when metric returns to normal but lastFiredAt is null', async () => {
    const config = makeConfig({
      currentBreachCount: 2,
      consecutiveBreaches: 3,
      lastFiredAt: null,
    });
    mockGetEnabledAlertConfigs.mockResolvedValue([config]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(50));

    await evaluateAlerts();

    // Resets breach count
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentBreachCount: 0 }),
    );
    // No resolution event or Slack
    expect(mockInsertAlertEvent).not.toHaveBeenCalled();
    expect(mockSendSlackAlert).not.toHaveBeenCalled();
  });

  // ── currentBreachCount is 0 and metric is normal → does nothing ──

  it('does nothing when metric is normal and breach count is already 0', async () => {
    const config = makeConfig({
      currentBreachCount: 0,
      lastFiredAt: null,
    });
    mockGetEnabledAlertConfigs.mockResolvedValue([config]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(50));

    await evaluateAlerts();

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsertAlertEvent).not.toHaveBeenCalled();
    expect(mockSendSlackAlert).not.toHaveBeenCalled();
  });

  // ── slackChannel passthrough ──────────────────────────

  it('passes slackChannel value as channel when set', async () => {
    const config = makeConfig({
      currentBreachCount: 2,
      consecutiveBreaches: 3,
      lastFiredAt: null,
      slackChannel: '#ops-alerts',
    });
    mockGetEnabledAlertConfigs.mockResolvedValue([config]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(95));

    await evaluateAlerts();

    expect(mockSendSlackAlert).toHaveBeenCalledWith(
      expect.objectContaining({ channel: '#ops-alerts' }),
    );
  });

  it('passes undefined as channel when slackChannel is null', async () => {
    const config = makeConfig({
      currentBreachCount: 2,
      consecutiveBreaches: 3,
      lastFiredAt: null,
      slackChannel: null,
    });
    mockGetEnabledAlertConfigs.mockResolvedValue([config]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(95));

    await evaluateAlerts();

    expect(mockSendSlackAlert).toHaveBeenCalledWith(
      expect.objectContaining({ channel: undefined }),
    );
  });

  it('passes slackChannel through on resolution as well', async () => {
    const config = makeConfig({
      currentBreachCount: 2,
      consecutiveBreaches: 3,
      lastFiredAt: new Date('2026-01-15T11:00:00Z'),
      slackChannel: '#ops-resolved',
    });
    mockGetEnabledAlertConfigs.mockResolvedValue([config]);
    mockGetLatestMetricValue.mockResolvedValue(makeMetric(50));

    await evaluateAlerts();

    expect(mockSendSlackAlert).toHaveBeenCalledWith(
      expect.objectContaining({ channel: '#ops-resolved' }),
    );
  });

  // ── Multiple configs processed ────────────────────────

  it('processes multiple configs independently', async () => {
    const config1 = makeConfig({
      id: 'cfg-1',
      metricKey: 'cpu.usage',
      condition: 'gt',
      threshold: 90,
      currentBreachCount: 0,
      consecutiveBreaches: 5,
    });
    const config2 = makeConfig({
      id: 'cfg-2',
      name: 'Memory Low',
      metricKey: 'mem.free',
      condition: 'lt',
      threshold: 100,
      currentBreachCount: 2,
      consecutiveBreaches: 3,
      lastFiredAt: null,
    });
    mockGetEnabledAlertConfigs.mockResolvedValue([config1, config2]);
    mockGetLatestMetricValue
      .mockResolvedValueOnce(makeMetric(95))  // cpu.usage: breaches gt 90
      .mockResolvedValueOnce(makeMetric(50)); // mem.free: breaches lt 100

    await evaluateAlerts();

    // Both should have their breach count incremented
    expect(mockGetLatestMetricValue).toHaveBeenCalledWith('cpu.usage');
    expect(mockGetLatestMetricValue).toHaveBeenCalledWith('mem.free');

    // config2 reaches consecutiveBreaches (2+1=3) => fires
    expect(mockInsertAlertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        alertConfigId: 'cfg-2',
        type: 'fired',
      }),
    );
  });
});
