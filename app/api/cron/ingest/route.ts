import { NextRequest, NextResponse } from 'next/server';
import { registry } from '@/lib/providers';
import { evaluateAlerts } from '@/lib/alerts/engine';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { results } = await registry.executeAll();

  // Evaluate alert rules after ingestion
  await evaluateAlerts();

  return NextResponse.json({ results });
}
