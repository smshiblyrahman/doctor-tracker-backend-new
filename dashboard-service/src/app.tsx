import { createBaseApp, finalizeApp, mountSwagger } from '@doctor-tracker/common';
import { dashboardRouter } from './routes/dashboard.routes';
import { swaggerSpec } from './swagger/swagger';

export function createApp() {
  const app = createBaseApp('dashboard-service');
  mountSwagger(app, swaggerSpec);
  app.use('/api/v1/dashboard', dashboardRouter);
  return finalizeApp(app);
}
