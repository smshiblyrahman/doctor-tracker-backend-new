import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { AppError } from '@doctor-tracker/common';
import { BCRYPT_COST, User } from '../models/User';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies, verifyRefreshToken } from '../services/token.service';
import type { LoginInput } from '../validators/auth.validator';

/** Compared against when the email is unknown so response time does not reveal which accounts exist. */
const DUMMY_HASH = bcrypt.hashSync('timing-safe-placeholder', BCRYPT_COST);

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as LoginInput;
  const user = await User.findOne({ email }).select('+password +tokenVersion');

  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !valid) throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');

  user.lastLoginAt = new Date();
  await user.save();

  setAuthCookies(res, user);
  res.json({ success: true, data: { user: user.toJSON() } });
}

/** Rotates both tokens. A refresh token issued before the last logout is rejected. */
export async function refresh(req: Request, res: Response) {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
  const claims = token ? verifyRefreshToken(token) : null;
  if (!claims) {
    clearAuthCookies(res);
    throw AppError.unauthorized('Session expired, please sign in again', 'SESSION_EXPIRED');
  }

  const user = await User.findById(claims.sub).select('+tokenVersion');
  if (!user || user.tokenVersion !== claims.ver) {
    clearAuthCookies(res);
    throw AppError.unauthorized('Session expired, please sign in again', 'SESSION_EXPIRED');
  }

  setAuthCookies(res, user);
  res.json({ success: true, data: { user: user.toJSON() } });
}

/** Revokes all refresh tokens for the user ("sign out everywhere") and clears cookies. */
export async function logout(req: Request, res: Response) {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
  const claims = token ? verifyRefreshToken(token) : null;
  if (claims) {
    await User.updateOne({ _id: claims.sub }, { $inc: { tokenVersion: 1 } });
  }
  clearAuthCookies(res);
  res.json({ success: true, data: null });
}

export async function me(req: Request, res: Response) {
  if (req.auth?.kind !== 'user') throw AppError.unauthorized();
  const user = await User.findById(req.auth.sub);
  if (!user) throw AppError.unauthorized('Account no longer exists');
  res.json({ success: true, data: { user: user.toJSON() } });
}
