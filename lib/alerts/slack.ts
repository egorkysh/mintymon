export async function sendSlackAlert(message: {
  text: string;
  color: 'danger' | 'good' | 'warning';
  fields: Array<{ title: string; value: string; short?: boolean }>;
  channel?: string;
}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[alerts] SLACK_WEBHOOK_URL is not set, skipping notification');
    return;
  }

  const payload = {
    ...(message.channel ? { channel: message.channel } : {}),
    attachments: [
      {
        color: message.color,
        text: message.text,
        fields: message.fields,
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`[alerts] Slack webhook failed: ${res.status}`);
  }
}
