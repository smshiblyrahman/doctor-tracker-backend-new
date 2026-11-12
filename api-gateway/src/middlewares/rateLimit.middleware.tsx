import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const handler = (code: string, message: string) =>
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: code === 'TOO_MANY_LOGIN_ATTEMPTS' ? env.LOGIN_RATE_LIMIT_MAX : env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Only failed logins count towards the login limit.
    skipSuccessfulRequests: code === 'TOO_MANY_LOGIN_ATTEMPTS',
    handler: (_req, res) => {
      res.status(429).json({ success: false, error: { code, message } });
    },
  });

export const apiLimiter = handler('RATE_LIMITED', 'Too many requests, please slow down');
export const loginLimiter = handler(
  'TOO_MANY_LOGIN_ATTEMPTS',
  'Too many failed sign-in attempts. Please try again in a few minutes.',
);
