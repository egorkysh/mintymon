import { NextRequest, NextResponse } from 'next/server';
import { getTimeseries } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const metricKey = searchParams.get('key');
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');
  const limitStr = searchParams.get('limit');

  if (!metricKey) {
    return NextResponse.json(
      { error: 'Missing required parameter: key' },
      { status: 400 }
    );
  }

  const now = new Date();
  const from = fromStr ? new Date(fromStr) : new Date(now.getTime() - 60 * 60 * 1000); // default 1h
  const to = toStr ? new Date(toStr) : now;
  const limit = limitStr ? parseInt(limitStr, 10) : 1000;

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json(
      { error: 'Invalid date format for from/to' },
      { status: 400 }
    );
  }

  const data = await getTimeseries(metricKey, from, to, limit);

  return NextResponse.json({ data });
}
