import cookieParser from 'cookie-parser';
import { createBaseApp, finalizeApp, mountSwagger } from '@doctor-tracker/common';
import { authRouter } from './routes/auth.routes';
import { swaggerSpec } from './swagger/swagger';

export function createApp() {
  const app = createBaseApp('auth-service');
  app.use(cookieParser());
  mountSwagger(app, swaggerSpec);
  app.use('/api/v1/auth', authRouter);
  return finalizeApp(app);
}
