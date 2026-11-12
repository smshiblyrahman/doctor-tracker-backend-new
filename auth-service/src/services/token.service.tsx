import jwt from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import { env } from '../config/env';
import type { UserDocument } from '../models/User';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

const ISSUER = 'doctor-tracker';
/** The gateway verifies access tokens against this audience. */
const ACCESS_AUDIENCE = 'doctor-tracker-client';
const REFRESH_AUDIENCE = 'doctor-tracker-refresh';

interface RefreshClaims {
  sub: string;
  ver: number;
}

export function signAccessToken(user: UserDocument): string {
  return jwt.sign({ email: user.email, role: user.role, name: user.name }, env.JWT_ACCESS_SECRET, {
    subject: String(user._id),
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    issuer: ISSUER,
    audience: ACCESS_AUDIENCE,
  });
}

export function signRefreshToken(user: UserDocument): string {
  return jwt.sign({ ver: user.tokenVersion }, env.JWT_REFRESH_SECRET, {
    subject: String(user._id),
    expiresIn: env.REFRESH_TOKEN_TTL_SECONDS,
    issuer: ISSUER,
    audience: REFRESH_AUDIENCE,
  });
}

export function verifyRefreshToken(token: string): RefreshClaims | null {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: ISSUER,
      audience: REFRESH_AUDIENCE,
    }) as jwt.JwtPayload;
    if (!payload.sub || typeof payload.ver !== 'number') return null;
    return { sub: payload.sub, ver: payload.ver };
  } catch {
    return null;
  }
}

function cookieOptions(maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}

export function setAuthCookies(res: Response, user: UserDocument): void {
  res.cookie(ACCESS_COOKIE, signAccessToken(user), cookieOptions(env.ACCESS_TOKEN_TTL_SECONDS));
  res.cookie(REFRESH_COOKIE, signRefreshToken(user), cookieOptions(env.REFRESH_TOKEN_TTL_SECONDS));
}

export function clearAuthCookies(res: Response): void {
  const { maxAge: _maxAge, ...base } = cookieOptions(0);
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}
