import { createBaseApp, finalizeApp, mountSwagger } from '@doctor-tracker/common';
import { patientRouter } from './routes/patient.routes';
import { internalRouter } from './routes/internal.routes';
import { swaggerSpec } from './swagger/swagger';

export function createApp() {
  const app = createBaseApp('patient-service');
  mountSwagger(app, swaggerSpec);
  app.use('/api/v1/patients', patientRouter);
  app.use('/internal/patients', internalRouter);
  return finalizeApp(app);
}
