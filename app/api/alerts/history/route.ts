import { NextRequest, NextResponse } from 'next/server';
import { getAlertHistory } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitStr = searchParams.get('limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 100;

  const history = await getAlertHistory(limit);
  return NextResponse.json({ history });
}
