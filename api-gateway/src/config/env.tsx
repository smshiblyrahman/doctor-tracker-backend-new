import { z } from 'zod';
import { loadEnv, nodeEnvSchema, secretSchema } from '@doctor-tracker/common';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: nodeEnvSchema,
  AUTH_SERVICE_URL: z.string().url(),
  DOCTOR_SERVICE_URL: z.string().url(),
  PATIENT_SERVICE_URL: z.string().url(),
  DASHBOARD_SERVICE_URL: z.string().url(),
  CLIENT_URL: z
    .string()
    .default('http://localhost:3000')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  JWT_ACCESS_SECRET: secretSchema,
  INTERNAL_JWT_SECRET: secretSchema,
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
});

export const env = loadEnv(schema);

export const services = {
  auth: env.AUTH_SERVICE_URL,
  doctor: env.DOCTOR_SERVICE_URL,
  patient: env.PATIENT_SERVICE_URL,
  dashboard: env.DASHBOARD_SERVICE_URL,
} as const;
