import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import type { Server } from 'node:http';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function requestLogger(service: string): RequestHandler {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      console.log(`[${service}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
    });
    next();
  };
}

/** Common hardening + JSON parsing + health endpoint for every backend service. */
export function createBaseApp(service: string, options: { parseJson?: boolean } = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  if (options.parseJson !== false) app.use(express.json({ limit: '100kb' }));
  app.use(requestLogger(service));
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service, uptimeSeconds: Math.round(process.uptime()) });
  });
  return app;
}

/** Must be called after all routes are registered. */
export function finalizeApp(app: Express): Express {
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

/** Closes the HTTP server and runs cleanup on SIGINT/SIGTERM. */
export function handleShutdown(server: Server, service: string, cleanup?: () => Promise<void>): void {
  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`[${service}] ${signal} received, shutting down`);
    server.close(async () => {
      try {
        await cleanup?.();
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
