import { describe, it, expect, vi } from 'vitest';

// Mock the database module before importing auth
vi.mock('../db', () => ({
  db: {},
}));

// Mock better-auth modules
const mockBetterAuth = vi.fn().mockReturnValue({
  api: {
    getSession: vi.fn(),
    signUpEmail: vi.fn(),
  },
  handler: vi.fn(),
});
vi.mock('better-auth', () => ({ betterAuth: mockBetterAuth }));
vi.mock('better-auth/adapters/drizzle', () => ({
  drizzleAdapter: vi.fn().mockReturnValue('drizzle-adapter'),
}));
vi.mock('better-auth/next-js', () => ({
  nextCookies: vi.fn().mockReturnValue('next-cookies-plugin'),
}));

describe('auth configuration', () => {
  it('initialises betterAuth with expected settings', async () => {
    // Import triggers the module-level betterAuth() call
    await import('../auth');

    expect(mockBetterAuth).toHaveBeenCalledOnce();

    const config = mockBetterAuth.mock.calls[0][0];

    // Email + password enabled with signup disabled
    expect(config.emailAndPassword).toEqual(
      expect.objectContaining({
        enabled: true,
        disableSignUp: true,
        maxPasswordLength: 128,
      }),
    );

    // Rate limiting persisted to database
    expect(config.rateLimit).toEqual(
      expect.objectContaining({
        enabled: true,
        storage: 'database',
      }),
    );

    // Custom rule for sign-in endpoint
    expect(config.rateLimit.customRules['/sign-in/email']).toEqual(
      expect.objectContaining({ max: 5 }),
    );

    // 8-hour session
    expect(config.session.expiresIn).toBe(8 * 60 * 60);

    // nextCookies plugin included
    expect(config.plugins).toContain('next-cookies-plugin');
  });
});
