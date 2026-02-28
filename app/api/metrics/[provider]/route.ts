import { NextRequest, NextResponse } from 'next/server';
import { getProviderSnapshot } from '@/lib/db/queries';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  const snapshot = await getProviderSnapshot(provider);

  if (!snapshot) {
    return NextResponse.json(
      { error: 'No data available for this provider' },
      { status: 404 }
    );
  }

  return NextResponse.json(snapshot);
}
