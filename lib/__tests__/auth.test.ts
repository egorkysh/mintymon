import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks – must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
}));

const mockSign = vi.fn().mockResolvedValue('mock-jwt-token');
const mockSetExpirationTime = vi.fn().mockReturnValue({ sign: mockSign });
const mockSetIssuedAt = vi.fn().mockReturnValue({ setExpirationTime: mockSetExpirationTime });
const mockSetProtectedHeader = vi.fn().mockReturnValue({ setIssuedAt: mockSetIssuedAt });

vi.mock('jose', () => ({
  SignJWT: vi.fn().mockImplementation(function () {
    return { setProtectedHeader: mockSetProtectedHeader };
  }),
}));

const mockCookieSet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ set: mockCookieSet })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { verifyPassword, createSession, setSessionCookie, clearSessionCookie } from '../auth';
import { compare } from 'bcryptjs';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  // Restore env to a known state with required values
  process.env = { ...ORIGINAL_ENV };
  process.env.ADMIN_SESSION_SECRET = 'test-secret';
  process.env.ADMIN_PASSWORD_HASH = '$2a$10$hashedpassword';
  delete process.env.JWT_VERSION;
});

// ---------------------------------------------------------------------------
// verifyPassword
// ---------------------------------------------------------------------------

describe('verifyPassword', () => {
  it('returns false when ADMIN_PASSWORD_HASH is not set', async () => {
    delete process.env.ADMIN_PASSWORD_HASH;

    const result = await verifyPassword('any-password');

    expect(result).toBe(false);
    expect(compare).not.toHaveBeenCalled();
  });

  it('returns true when the password matches the hash', async () => {
    vi.mocked(compare).mockResolvedValue(true as never);

    const result = await verifyPassword('correct-password');

    expect(result).toBe(true);
    expect(compare).toHaveBeenCalledWith('correct-password', '$2a$10$hashedpassword');
  });

  it('returns false when the password does not match the hash', async () => {
    vi.mocked(compare).mockResolvedValue(false as never);

    const result = await verifyPassword('wrong-password');

    expect(result).toBe(false);
    expect(compare).toHaveBeenCalledWith('wrong-password', '$2a$10$hashedpassword');
  });
});

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

describe('createSession', () => {
  it('produces a token string', async () => {
    const token = await createSession();

    expect(typeof token).toBe('string');
    expect(token).toBe('mock-jwt-token');
  });

  it('creates a SignJWT with sub "admin" and default jwtVersion "1" when JWT_VERSION is not set', async () => {
    delete process.env.JWT_VERSION;

    await createSession();

    expect(SignJWT).toHaveBeenCalledWith({ sub: 'admin', jwtVersion: '1' });
  });

  it('uses the JWT_VERSION env var when it is set', async () => {
    process.env.JWT_VERSION = '42';

    await createSession();

    expect(SignJWT).toHaveBeenCalledWith({ sub: 'admin', jwtVersion: '42' });
  });

  it('uses HS256 algorithm in the protected header', async () => {
    await createSession();

    expect(mockSetProtectedHeader).toHaveBeenCalledWith({ alg: 'HS256' });
  });

  it('sets issued-at and expiration time of 8h', async () => {
    await createSession();

    expect(mockSetIssuedAt).toHaveBeenCalledOnce();
    expect(mockSetExpirationTime).toHaveBeenCalledWith('8h');
  });

  it('signs with the encoded ADMIN_SESSION_SECRET', async () => {
    await createSession();

    const expectedSecret = new TextEncoder().encode('test-secret');
    expect(mockSign).toHaveBeenCalledWith(expectedSecret);
  });

  it('throws when ADMIN_SESSION_SECRET is not set', async () => {
    delete process.env.ADMIN_SESSION_SECRET;

    await expect(createSession()).rejects.toThrow('ADMIN_SESSION_SECRET is not set');
  });
});

// ---------------------------------------------------------------------------
// setSessionCookie
// ---------------------------------------------------------------------------

describe('setSessionCookie', () => {
  it('sets a cookie with the correct name and token value', async () => {
    await setSessionCookie('my-token');

    expect(mockCookieSet).toHaveBeenCalledWith(
      'mintymon-session',
      'my-token',
      expect.objectContaining({}),
    );
  });

  it('sets httpOnly to true', async () => {
    await setSessionCookie('token');

    expect(mockCookieSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('sets secure to true', async () => {
    await setSessionCookie('token');

    expect(mockCookieSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ secure: true }),
    );
  });

  it('sets sameSite to strict', async () => {
    await setSessionCookie('token');

    expect(mockCookieSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ sameSite: 'strict' }),
    );
  });

  it('sets path to /', async () => {
    await setSessionCookie('token');

    expect(mockCookieSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ path: '/' }),
    );
  });

  it('sets maxAge to 8 hours (28800 seconds)', async () => {
    await setSessionCookie('token');

    expect(mockCookieSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ maxAge: 28800 }),
    );
  });

  it('sets all cookie options together correctly', async () => {
    await setSessionCookie('full-token');

    expect(mockCookieSet).toHaveBeenCalledWith('mintymon-session', 'full-token', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 28800,
    });
  });
});

// ---------------------------------------------------------------------------
// clearSessionCookie
// ---------------------------------------------------------------------------

describe('clearSessionCookie', () => {
  it('sets the cookie value to an empty string', async () => {
    await clearSessionCookie();

    expect(mockCookieSet).toHaveBeenCalledWith(
      'mintymon-session',
      '',
      expect.objectContaining({}),
    );
  });

  it('sets maxAge to 0 to expire the cookie immediately', async () => {
    await clearSessionCookie();

    expect(mockCookieSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ maxAge: 0 }),
    );
  });

  it('preserves httpOnly, secure, sameSite, and path options', async () => {
    await clearSessionCookie();

    expect(mockCookieSet).toHaveBeenCalledWith('mintymon-session', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
  });
});
