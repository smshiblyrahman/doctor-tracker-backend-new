import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createBaseApp } from '@doctor-tracker/common';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { apiLimiter } from './middlewares/rateLimit.middleware';
import { checkServices, registerProxyRoutes } from './routes/proxy.routes';
import { mountAggregatedSwagger } from './swagger/aggregate';

export function createApp() {
  // Bodies are streamed to services untouched, so the gateway must not parse JSON.
  const app = createBaseApp('api-gateway', { parseJson: false });

  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  app.get('/health/services', async (_req, res) => {
    const status = await checkServices();
    const healthy = Object.values(status).every((s) => s === 'up');
    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', services: status });
  });

  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'Backend API is running successfully!',
      data: {
        status: 'healthy',
        service: 'Backend API',
        gateway: 'api-gateway',
        version: '1.0.0',
        docs: '/api-docs',
      },
    });
  });

  mountAggregatedSwagger(app);
  app.use('/api', apiLimiter);
  registerProxyRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
