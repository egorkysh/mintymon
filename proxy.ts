import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'mintymon-session';

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not set');
  return new TextEncoder().encode(secret);
}

function getJwtVersion(): string {
  return process.env.JWT_VERSION ?? '1';
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check for login page, auth APIs, and static assets
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Verify Origin header on mutating requests (CSRF defense-in-depth)
  if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const url = new URL(request.url);
    if (origin && origin !== url.origin) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });
    }
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
    });
    if (payload.sub !== 'admin' || payload.jwtVersion !== getJwtVersion()) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login
     * - /api/auth/*
     * - /api/cron/*
     * - /_next/static, /_next/image
     * - /favicon.ico
     */
    '/((?!login|api/auth|api/cron|_next/static|_next/image|favicon.ico).*)',
  ],
};
