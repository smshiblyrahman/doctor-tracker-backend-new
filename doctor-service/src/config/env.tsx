import { z } from 'zod';
import { loadEnv, nodeEnvSchema, secretSchema } from '@doctor-tracker/common';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(5002),
  NODE_ENV: nodeEnvSchema,
  MONGO_URI: z.string().min(1),
  PATIENT_SERVICE_URL: z.string().url(),
  INTERNAL_JWT_SECRET: secretSchema,
});

export const env = loadEnv(schema);
