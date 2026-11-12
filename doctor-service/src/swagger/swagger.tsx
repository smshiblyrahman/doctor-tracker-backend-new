import path from 'node:path';
import { buildSwaggerSpec } from '@doctor-tracker/common';
import { env } from '../config/env';

export const swaggerSpec = buildSwaggerSpec({
  title: 'Doctor Service API',
  description: 'Doctor CRUD, prefix search, filters and pagination; doctor→patient flows delegated to patient-service.',
  port: env.PORT,
  routesDir: path.resolve(__dirname, '../routes'),
});
