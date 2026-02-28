import { NextRequest, NextResponse } from 'next/server';
import { runRetention } from '@/lib/db/retention';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await runRetention();

  return NextResponse.json({ success: true });
}
