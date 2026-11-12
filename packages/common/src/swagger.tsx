import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { INTERNAL_AUTH_HEADER } from './auth/internalToken';

export interface SwaggerOptions {
  title: string;
  description: string;
  port: number;
  /** Absolute directory holding the annotated route files. */
  routesDir: string;
  /** Extra reusable schemas for `components.schemas`. */
  schemas?: Record<string, unknown>;
}

/** Schemas shared by every service spec (merged into the gateway's aggregate as well). */
export const commonSchemas = {
  ErrorResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      error: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string', example: 'Validation failed' },
          details: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  },
  Pagination: {
    type: 'object',
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 10 },
      total: { type: 'integer', example: 42 },
      totalPages: { type: 'integer', example: 5 },
      hasNextPage: { type: 'boolean' },
      hasPrevPage: { type: 'boolean' },
    },
  },
};

/**
 * Route files are read at runtime for their JSDoc. In a bundled build `__dirname`
 * is `dist/`, so fall back to `<cwd>/src/routes` (the service directory).
 */
function resolveRoutesDir(preferred: string): string {
  if (fs.existsSync(preferred)) return preferred;
  return path.resolve(process.cwd(), 'src', 'routes');
}

export function buildSwaggerSpec(options: SwaggerOptions): Record<string, any> {
  return swaggerJSDoc({
    definition: {
      openapi: '3.0.3',
      info: { title: options.title, version: '1.0.0', description: options.description },
      servers: [{ url: `http://localhost:${options.port}`, description: 'Direct service access' }],
      components: {
        securitySchemes: {
          InternalAuth: {
            type: 'apiKey',
            in: 'header',
            name: INTERNAL_AUTH_HEADER,
            description: 'Short-lived internal JWT. Generate one with `npm run token` in /backend.',
          },
        },
        schemas: { ...commonSchemas, ...(options.schemas ?? {}) },
      },
      security: [{ InternalAuth: [] }],
    },
    apis: [path.join(resolveRoutesDir(options.routesDir), '*.tsx').replace(/\\/g, '/')],
  }) as Record<string, any>;
}

/** Serves Swagger UI at `/api-docs` and the raw spec at `/api-docs.json`. */
export function mountSwagger(app: Express, spec: Record<string, any>): void {
  app.get('/api-docs.json', (_req, res) => {
    res.json(spec);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: spec.info?.title }));
}
