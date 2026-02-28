import 'server-only';
import { compare } from 'bcryptjs';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'mintymon-session';

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not set');
  return new TextEncoder().encode(secret);
}

function getJwtVersion(): string {
  return process.env.JWT_VERSION ?? '1';
}

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return false;
  return compare(password, hash);
}

export async function createSession(): Promise<string> {
  const token = await new SignJWT({
    sub: 'admin',
    jwtVersion: getJwtVersion(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret());

  return token;
}

export function setSessionCookie(token: string) {
  const cookieStore = cookies();
  // cookies() returns a Promise in Next.js 16 — but we call this
  // synchronously within a route handler where it's safe.
  // We'll use the async pattern below.
  return cookieStore.then((c) =>
    c.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    })
  );
}

export function clearSessionCookie() {
  return cookies().then((c) =>
    c.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    })
  );
}

