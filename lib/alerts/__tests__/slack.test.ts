import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendSlackAlert } from '../slack';

describe('sendSlackAlert', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    // Isolate env mutations per test
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
  });

  const baseMessage = {
    text: 'Alert: CPU High',
    color: 'danger' as const,
    fields: [
      { title: 'Metric', value: 'cpu.usage', short: true },
      { title: 'Value', value: '95', short: true },
    ],
  };

  // ── No webhook URL ────────────────────────────────────

  it('logs a warning and returns early when SLACK_WEBHOOK_URL is not set', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await sendSlackAlert(baseMessage);

    expect(warnSpy).toHaveBeenCalledWith(
      '[alerts] SLACK_WEBHOOK_URL is not set, skipping notification',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ── Successful POST ───────────────────────────────────

  it('sends POST with correct payload structure when webhook is set', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );

    await sendSlackAlert(baseMessage);

    expect(fetchSpy).toHaveBeenCalledWith('https://hooks.slack.com/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [
          {
            color: 'danger',
            text: 'Alert: CPU High',
            fields: [
              { title: 'Metric', value: 'cpu.usage', short: true },
              { title: 'Value', value: '95', short: true },
            ],
            ts: Math.floor(new Date('2026-01-15T12:00:00Z').getTime() / 1000),
          },
        ],
      }),
    });
  });

  // ── With channel override ─────────────────────────────

  it('includes channel in payload when channel override is provided', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );

    await sendSlackAlert({ ...baseMessage, channel: '#ops-alerts' });

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(callBody.channel).toBe('#ops-alerts');
    expect(callBody.attachments).toHaveLength(1);
    expect(callBody.attachments[0].color).toBe('danger');
  });

  // ── Without channel ───────────────────────────────────

  it('does not include channel field when no channel is provided', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );

    await sendSlackAlert(baseMessage);

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(callBody).not.toHaveProperty('channel');
  });

  it('does not include channel field when channel is undefined', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );

    await sendSlackAlert({ ...baseMessage, channel: undefined });

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(callBody).not.toHaveProperty('channel');
  });

  // ── Payload structure validation ──────────────────────

  it('includes ts as Unix epoch seconds in the attachment', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );

    await sendSlackAlert(baseMessage);

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    const expectedTs = Math.floor(new Date('2026-01-15T12:00:00Z').getTime() / 1000);
    expect(callBody.attachments[0].ts).toBe(expectedTs);
  });

  it('includes fields in the attachment', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );

    const fields = [
      { title: 'A', value: '1', short: true },
      { title: 'B', value: '2' },
    ];
    await sendSlackAlert({ ...baseMessage, fields });

    const fetchSpy = vi.mocked(globalThis.fetch);
    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(callBody.attachments[0].fields).toEqual(fields);
  });

  // ── Non-ok response → logs error ──────────────────────

  it('logs error when response is not ok', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('server error', { status: 500 }),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await sendSlackAlert(baseMessage);

    expect(errorSpy).toHaveBeenCalledWith('[alerts] Slack webhook failed: 500');
  });

  it('logs error with specific status code', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('forbidden', { status: 403 }),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await sendSlackAlert(baseMessage);

    expect(errorSpy).toHaveBeenCalledWith('[alerts] Slack webhook failed: 403');
  });

  // ── Ok response → no error logged ─────────────────────

  it('does not log error when response is ok', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await sendSlackAlert(baseMessage);

    expect(errorSpy).not.toHaveBeenCalled();
  });

  // ── Different color values ────────────────────────────

  it('sends correct color for "good" messages', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );

    await sendSlackAlert({ ...baseMessage, color: 'good' });

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(callBody.attachments[0].color).toBe('good');
  });

  it('sends correct color for "warning" messages', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );

    await sendSlackAlert({ ...baseMessage, color: 'warning' });

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(callBody.attachments[0].color).toBe('warning');
  });
});
