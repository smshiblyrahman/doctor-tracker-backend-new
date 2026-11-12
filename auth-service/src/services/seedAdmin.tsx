import { env } from '../config/env';
import { User } from '../models/User';

/** Ensures the configured admin account exists so a fresh install can log in. */
export async function seedAdmin(): Promise<void> {
  const email = env.ADMIN_EMAIL.toLowerCase();
  const existing = await User.exists({ email });
  if (existing) return;
  await User.create({ name: env.ADMIN_NAME, email, password: env.ADMIN_PASSWORD, role: 'admin' });
  console.log(`[auth-service] Seeded admin user ${email}`);
}
