import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/** Loads `.env` from the service directory and validates it; exits on invalid config. */
export function loadEnv<S extends z.ZodTypeAny>(schema: S): z.infer<S> {
  loadDotenv();
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

/** Secrets must be long enough to resist brute force; dev defaults are rejected in production. */
export const secretSchema = z.string().min(32, 'must be at least 32 characters');

export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

export const booleanString = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');
