import path from 'node:path';
import { buildSwaggerSpec } from '@doctor-tracker/common';
import { env } from '../config/env';

export const swaggerSpec = buildSwaggerSpec({
  title: 'Patient Service API',
  description: 'Patient listing, editing and deletion, plus the aggregations behind the dashboard.',
  port: env.PORT,
  routesDir: path.resolve(__dirname, '../routes'),
});
