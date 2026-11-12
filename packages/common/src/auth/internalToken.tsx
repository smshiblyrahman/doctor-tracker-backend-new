import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { AppError } from '../errors';
import type { AuthContext } from '../types';

/**
 * Header carrying a short-lived JWT between services. The gateway mints one per
 * request after verifying the user's access cookie; services mint their own
 * (kind = "service") for service-to-service calls. Downstream services trust
 * only this header, never client cookies.
 */
export const INTERNAL_AUTH_HEADER = 'x-internal-auth';

const ISSUER = 'doctor-tracker';
const AUDIENCE = 'doctor-tracker-internal';

export function signInternalToken(context: AuthContext, secret: string, ttlSeconds = 60): string {
  const { sub, ...rest } = context;
  return jwt.sign(rest, secret, {
    subject: sub,
    expiresIn: ttlSeconds,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function verifyInternalToken(token: string, secret: string): AuthContext {
  const payload = jwt.verify(token, secret, { issuer: ISSUER, audience: AUDIENCE }) as jwt.JwtPayload;
  if (!payload.sub || (payload.kind !== 'user' && payload.kind !== 'service')) {
    throw new Error('Malformed internal token');
  }
  return {
    kind: payload.kind,
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    name: payload.name,
  };
}

interface RequireInternalAuthOptions {
  /** Reject end-user identities: only other services may call. */
  serviceOnly?: boolean;
}

export function requireInternalAuth(secret: string, options: RequireInternalAuthOptions = {}): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers[INTERNAL_AUTH_HEADER];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token) return next(AppError.unauthorized('Missing internal authentication'));
    try {
      const auth = verifyInternalToken(token, secret);
      if (options.serviceOnly && auth.kind !== 'service') {
        return next(AppError.forbidden('This endpoint is restricted to internal services'));
      }
      req.auth = auth;
      next();
    } catch {
      next(AppError.unauthorized('Invalid or expired internal authentication'));
    }
  };
}
