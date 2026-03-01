import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '.';

// Standalone auth instance with signup enabled for seeding only.
const seedAuth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
});

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD env vars are required.');
    process.exit(1);
  }

  const result = await seedAuth.api.signUpEmail({
    body: { name: 'Admin', email, password },
  });

  if ('error' in result && result.error) {
    console.error('Failed to create admin user:', result.error);
    process.exit(1);
  }

  console.warn(`Admin user created: ${email}`);
}

seedAdmin();
