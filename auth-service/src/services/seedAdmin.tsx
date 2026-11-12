import { env } from '../config/env';
import { User } from '../models/User';

/** Ensures the configured admin account exists so a fresh install can log in. */
export async function seedAdmin(): Promise<void> {
  const email = env.ADMIN_EMAIL.toLowerCase();
  const existing = await User.exists({ email });
  if (!existing) {
    await User.create({ name: env.ADMIN_NAME, email, password: env.ADMIN_PASSWORD, role: 'admin' });
    console.log(`[auth-service] Seeded admin user ${email}`);
  }

  // Seed default demo patient user for testing
  const patientEmail = 'patient@doctortracker.dev';
  const existingPatient = await User.exists({ email: patientEmail });
  if (!existingPatient) {
    await User.create({
      name: 'Demo Patient',
      email: patientEmail,
      password: 'Patient@12345',
      role: 'patient',
    });
    console.log(`[auth-service] Seeded patient user ${patientEmail}`);
  }
}
