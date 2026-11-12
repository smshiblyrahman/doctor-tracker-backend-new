import { z } from 'zod';
import { loadEnv, nodeEnvSchema, secretSchema } from '@doctor-tracker/common';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(5003),
  NODE_ENV: nodeEnvSchema,
  MONGO_URI: z.string().min(1),
  INTERNAL_JWT_SECRET: secretSchema,
});

export const env = loadEnv(schema);
