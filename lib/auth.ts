import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { db } from './db';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 8 * 60 * 60, // 8 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // revalidate from DB every 5 min
    },
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 5,
    customRules: {
      '/sign-in/email': {
        window: 60,
        max: 5,
      },
    },
  },
  plugins: [nextCookies()],
});
