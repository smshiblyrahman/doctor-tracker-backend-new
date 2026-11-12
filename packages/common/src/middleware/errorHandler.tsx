import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors';

interface ZodLikeIssue {
  path: (string | number)[];
  message: string;
}

/** Duck-typed so the gateway and dashboard do not need to load mongoose. */
function normalizeError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const e = err as Record<string, any> | null;
  if (!e || typeof e !== 'object') return new AppError(500, 'INTERNAL_ERROR', 'Something went wrong');

  if (e.name === 'ZodError' && Array.isArray(e.issues)) {
    return AppError.validation(
      (e.issues as ZodLikeIssue[]).map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  if (e.name === 'CastError') {
    return AppError.badRequest(`Invalid value for "${e.path}"`);
  }
  if (e.name === 'ValidationError' && e.errors) {
    return AppError.validation(
      Object.values(e.errors as Record<string, { path: string; message: string }>).map((v) => ({
        path: v.path,
        message: v.message,
      })),
    );
  }
  if (e.code === 11000) {
    const field = Object.keys(e.keyValue ?? e.keyPattern ?? {})[0] ?? 'field';
    return AppError.conflict(`A record with this ${field} already exists`);
  }
  if (e.type === 'entity.parse.failed') {
    return AppError.badRequest('Malformed JSON body');
  }
  if (e.type === 'entity.too.large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }
  return new AppError(500, 'INTERNAL_ERROR', 'Something went wrong');
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

/** Single error shape for every service: `{ success: false, error: { code, message, details? } }`. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = normalizeError(err);
  if (appError.statusCode >= 500 && process.env.NODE_ENV !== 'test') {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }
  if (res.headersSent) return;
  res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined ? { details: appError.details } : {}),
    },
  });
};
