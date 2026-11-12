import type { Express } from 'express';
import type { ServerResponse } from 'node:http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { services } from '../config/env';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { loginLimiter } from '../middlewares/rateLimit.middleware';

/**
 * Proxies everything under `basePath` to the same path on `target`. Express strips
 * the mount path from `req.url`, so it is re-added via the target URL.
 */
function proxyTo(target: string, basePath: string, serviceName: string) {
  return createProxyMiddleware({
    target: `${target}${basePath}`,
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: 15_000,
    on: {
      error: (_err, _req, res) => {
        const response = res as ServerResponse;
        if (typeof response.writeHead !== 'function' || response.headersSent) return;
        response.writeHead(502, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            success: false,
            error: { code: 'SERVICE_UNAVAILABLE', message: `${serviceName} is temporarily unavailable` },
          }),
        );
      },
    },
  });
}

export function registerProxyRoutes(app: Express) {
  // Auth: public login/refresh/logout; /me needs a valid session, which auth-service checks.
  app.use('/api/v1/auth/login', loginLimiter);
  app.use(
    '/api/v1/auth',
    authenticate({ required: false }),
    proxyTo(services.auth, '/api/v1/auth', 'Auth service'),
  );

  const authenticatedUser = [authenticate({ required: true }), requireRole('admin', 'patient')];
  app.use('/api/v1/doctors', ...authenticatedUser, proxyTo(services.doctor, '/api/v1/doctors', 'Doctor service'));
  app.use('/api/v1/patients', ...authenticatedUser, proxyTo(services.patient, '/api/v1/patients', 'Patient service'));
  app.use('/api/v1/dashboard', ...authenticatedUser, proxyTo(services.dashboard, '/api/v1/dashboard', 'Dashboard service'));
}

/** Liveness of every downstream service, for ops and the README's quick check. */
export async function checkServices(): Promise<Record<string, 'up' | 'down'>> {
  const entries = await Promise.all(
    Object.entries(services).map(async ([name, url]) => {
      try {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
        return [name, res.ok ? 'up' : 'down'] as const;
      } catch {
        return [name, 'down'] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

