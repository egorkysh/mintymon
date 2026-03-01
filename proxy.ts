import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for login page, auth APIs, cron routes, and static assets
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // CSRF origin check on mutating requests (defense-in-depth for non-auth routes)
  if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const url = new URL(request.url);
    if (origin && origin !== url.origin) {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });
    }
  }

  // Validate session via Better Auth (database-backed)
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!login|api/auth|api/cron|_next/static|_next/image|favicon.ico).*)',
  ],
};
