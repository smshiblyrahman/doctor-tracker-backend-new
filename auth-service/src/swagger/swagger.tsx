import path from 'node:path';
import { buildSwaggerSpec } from '@doctor-tracker/common';
import { env } from '../config/env';

export const swaggerSpec = buildSwaggerSpec({
  title: 'Auth Service API',
  description: 'Issues and rotates JWT session cookies for Doctor Tracker administrators.',
  port: env.PORT,
  routesDir: path.resolve(__dirname, '../routes'),
});
