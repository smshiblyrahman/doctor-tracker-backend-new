import { z } from 'zod';
import { booleanString, loadEnv, nodeEnvSchema, secretSchema } from '@doctor-tracker/common';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(5001),
  NODE_ENV: nodeEnvSchema,
  MONGO_URI: z.string().min(1),
  JWT_ACCESS_SECRET: secretSchema,
  JWT_REFRESH_SECRET: secretSchema,
  INTERNAL_JWT_SECRET: secretSchema,
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  COOKIE_SECURE: booleanString.default('false'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  ADMIN_NAME: z.string().min(1).default('Admin User'),
  ADMIN_EMAIL: z.string().email().default('admin@doctortracker.dev'),
  ADMIN_PASSWORD: z.string().min(8).default('Admin@12345'),
});

export const env = loadEnv(schema);
