import jwt from 'jsonwebtoken';
import type { Request, RequestHandler } from 'express';
import { AppError, INTERNAL_AUTH_HEADER, signInternalToken } from '@doctor-tracker/common';
import { env } from '../config/env';

export const ACCESS_COOKIE = 'access_token';

interface AccessClaims extends jwt.JwtPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
}

function readAccessToken(req: Request): string | undefined {
  const fromCookie: string | undefined = req.cookies?.[ACCESS_COOKIE];
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

/**
 * Verifies the user's access token (httpOnly cookie, or Bearer header for API
 * clients) and replaces it with a short-lived internal token for the target
 * service. Any client-supplied internal header is stripped first so it cannot be
 * spoofed from outside.
 */
export function authenticate(options: { required: boolean }): RequestHandler {
  return (req, _res, next) => {
    delete req.headers[INTERNAL_AUTH_HEADER];
    const token = readAccessToken(req);
    if (!token) return options.required ? next(AppError.unauthorized()) : next();

    try {
      const claims = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        issuer: 'doctor-tracker',
        audience: 'doctor-tracker-client',
      }) as AccessClaims;
      req.auth = { kind: 'user', sub: claims.sub, email: claims.email, role: claims.role, name: claims.name };
      req.headers[INTERNAL_AUTH_HEADER] = signInternalToken(req.auth, env.INTERNAL_JWT_SECRET, 60);
      next();
    } catch (err) {
      if (!options.required) return next();
      const expired = err instanceof jwt.TokenExpiredError;
      next(
        AppError.unauthorized(
          expired ? 'Access token expired' : 'Invalid access token',
          expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        ),
      );
    }
  };
}

/** Authorization: only the listed roles may reach the route. */
export function requireRole(...roles: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth?.role || !roles.includes(req.auth.role)) return next(AppError.forbidden());
    next();
  };
}
