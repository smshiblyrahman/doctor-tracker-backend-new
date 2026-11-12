import type { Request, RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../errors';

interface Schemas {
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  body?: ZodTypeAny;
}

/**
 * Validates and coerces request input with zod before it reaches a controller.
 * Express 5 makes `req.query` read-only, so parsed values live on `req.validated`
 * (and `req.body` is replaced with its parsed form).
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const validated: Record<string, unknown> = {};
    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key] ?? {});
      if (!result.success) {
        return next(
          AppError.validation(
            result.error.issues.map((i) => ({ path: [key, ...i.path].join('.'), message: i.message })),
          ),
        );
      }
      validated[key] = result.data;
    }
    req.validated = { ...req.validated, ...validated };
    if ('body' in validated) req.body = validated.body;
    next();
  };
}

/** Typed accessor for data produced by `validate()`. */
export function validated<T>(req: Request, key: 'params' | 'query' | 'body'): T {
  const value = req.validated?.[key];
  if (value === undefined) throw new Error(`No validated ${key} on request; missing validate() middleware`);
  return value as T;
}
