import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { services } from '../config/env';

const CACHE_MS = 60_000;
let cached: { spec: Record<string, any>; at: number } | null = null;

/** Drops service-internal operations: they are not reachable through the gateway. */
function publicPaths(paths: Record<string, unknown> = {}) {
  return Object.fromEntries(Object.entries(paths).filter(([path]) => path.startsWith('/api/v1/')));
}

/**
 * Fetches each service's `/api-docs.json` and merges paths, schemas and tags into
 * one spec served by the gateway. Requests from this Swagger UI go through the
 * gateway, so they authenticate with the session cookie set by `POST /auth/login`.
 */
export async function buildAggregateSpec(): Promise<Record<string, any>> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.spec;

  const results = await Promise.all(
    Object.entries(services).map(async ([name, url]) => {
      try {
        const res = await fetch(`${url}/api-docs.json`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error(String(res.status));
        return { name, spec: (await res.json()) as Record<string, any> };
      } catch {
        return { name, spec: null };
      }
    }),
  );

  const unavailable = results.filter((r) => !r.spec).map((r) => r.name);
  const spec: Record<string, any> = {
    openapi: '3.0.3',
    info: {
      title: 'Doctor Tracker API (Gateway)',
      version: '1.0.0',
      description: [
        'Combined API of all Doctor Tracker services, served through the gateway.',
        '',
        '**To try requests:** call `POST /api/v1/auth/login` first (admin@doctortracker.dev / Admin@12345).',
        'The session cookie it sets is sent automatically with every following request.',
        unavailable.length ? `\n\n⚠️ Unavailable when this spec was built: ${unavailable.join(', ')}` : '',
      ].join('\n'),
    },
    servers: [{ url: '/', description: 'API gateway' }],
    tags: [],
    paths: {},
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' },
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {},
    },
    security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  };

  for (const { spec: serviceSpec } of results) {
    if (!serviceSpec) continue;
    Object.assign(spec.paths, publicPaths(serviceSpec.paths));
    Object.assign(spec.components.schemas, serviceSpec.components?.schemas ?? {});
    for (const tag of serviceSpec.tags ?? []) {
      if (tag.name !== 'Internal' && !spec.tags.some((t: { name: string }) => t.name === tag.name)) {
        spec.tags.push(tag);
      }
    }
  }

  if (!unavailable.length) cached = { spec, at: Date.now() };
  return spec;
}

export function mountAggregatedSwagger(app: Express) {
  app.get('/api-docs.json', async (_req, res) => {
    res.json(await buildAggregateSpec());
  });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      customSiteTitle: 'Doctor Tracker API',
      swaggerOptions: { url: '/api-docs.json', withCredentials: true, persistAuthorization: true },
    }),
  );
}
