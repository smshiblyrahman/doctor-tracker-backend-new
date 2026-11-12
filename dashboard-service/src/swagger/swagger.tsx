import path from 'node:path';
import { buildSwaggerSpec } from '@doctor-tracker/common';
import { env } from '../config/env';

export const swaggerSpec = buildSwaggerSpec({
  title: 'Dashboard Service API',
  description:
    'Analytics endpoints. All heavy aggregation ($group / $dateToString) runs inside the data-owning services; this service composes and caches.',
  port: env.PORT,
  routesDir: path.resolve(__dirname, '../routes'),
});
