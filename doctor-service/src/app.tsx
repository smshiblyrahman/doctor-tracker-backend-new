import { createBaseApp, finalizeApp, mountSwagger } from '@doctor-tracker/common';
import { doctorRouter } from './routes/doctor.routes';
import { internalRouter } from './routes/internal.routes';
import { swaggerSpec } from './swagger/swagger';

export function createApp() {
  const app = createBaseApp('doctor-service');
  mountSwagger(app, swaggerSpec);
  app.use('/api/v1/doctors', doctorRouter);
  app.use('/internal/doctors', internalRouter);
  return finalizeApp(app);
}
