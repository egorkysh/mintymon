import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth';

// Simple in-memory rate limiting: 5 failures per minute per IP
const failureMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = failureMap.get(ip);

  if (!entry || now > entry.resetAt) {
    return true;
  }

  return entry.count < 5;
}

function recordFailure(ip: string) {
  const now = Date.now();
  const entry = failureMap.get(ip);

  if (!entry || now > entry.resetAt) {
    failureMap.set(ip, { count: 1, resetAt: now + 60_000 });
  } else {
    entry.count++;
  }
}

function clearFailures(ip: string) {
  failureMap.delete(ip);
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again later.' },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { password } = body;

  if (!password || typeof password !== 'string') {
    return NextResponse.json(
      { error: 'Password is required' },
      { status: 400 }
    );
  }

  const valid = await verifyPassword(password);

  if (!valid) {
    recordFailure(ip);
    return NextResponse.json(
      { error: 'Invalid password' },
      { status: 401 }
    );
  }

  clearFailures(ip);
  const token = await createSession();
  await setSessionCookie(token);

  return NextResponse.json({ success: true });
}
