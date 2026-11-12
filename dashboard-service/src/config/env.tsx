import { z } from 'zod';
import { loadEnv, nodeEnvSchema, secretSchema } from '@doctor-tracker/common';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(5004),
  NODE_ENV: nodeEnvSchema,
  DOCTOR_SERVICE_URL: z.string().url(),
  PATIENT_SERVICE_URL: z.string().url(),
  INTERNAL_JWT_SECRET: secretSchema,
  CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(30),
});

export const env = loadEnv(schema);
