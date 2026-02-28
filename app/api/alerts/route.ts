import { NextRequest, NextResponse } from 'next/server';
import {
  getAllAlertConfigs,
  createAlertConfig,
  updateAlertConfig,
  deleteAlertConfig,
} from '@/lib/db/queries';

export async function GET() {
  const configs = await getAllAlertConfigs();
  return NextResponse.json({ configs });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, metricKey, condition, threshold, consecutiveBreaches, cooldownSeconds, slackChannel } = body;

  if (!name || !metricKey || !condition || threshold == null) {
    return NextResponse.json(
      { error: 'Missing required fields: name, metricKey, condition, threshold' },
      { status: 400 }
    );
  }

  const config = await createAlertConfig({
    name,
    metricKey,
    condition,
    threshold,
    consecutiveBreaches,
    cooldownSeconds,
    slackChannel,
  });

  return NextResponse.json({ config }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
  }

  await updateAlertConfig(id, updates);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 });
  }

  await deleteAlertConfig(id);
  return NextResponse.json({ success: true });
}
