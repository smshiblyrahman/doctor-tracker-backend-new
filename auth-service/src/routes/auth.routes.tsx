import { Router } from 'express';
import { requireInternalAuth, validate } from '@doctor-tracker/common';
import { env } from '../config/env';
import * as controller from '../controllers/auth.controller';
import { loginSchema } from '../validators/auth.validator';

export const authRouter = Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Session management (httpOnly cookie based)
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id: { type: string, example: 665f1c2b9a1e4b0012345678 }
 *         name: { type: string, example: Admin User }
 *         email: { type: string, example: admin@doctortracker.dev }
 *         role: { type: string, enum: [admin] }
 *         lastLoginAt: { type: string, format: date-time }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     SessionResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         data:
 *           type: object
 *           properties:
 *             user: { $ref: '#/components/schemas/User' }
 */

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Sign in and receive httpOnly access + refresh cookies
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: admin@doctortracker.dev }
 *               password: { type: string, example: Admin@12345 }
 *     responses:
 *       200:
 *         description: Signed in. Sets `access_token` and `refresh_token` cookies.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SessionResponse' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Invalid credentials, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
authRouter.post('/login', validate({ body: loginSchema }), controller.login);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate the access and refresh tokens using the refresh cookie
 *     security: []
 *     responses:
 *       200:
 *         description: New cookies issued
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SessionResponse' }
 *       401: { description: Refresh token missing, expired or revoked }
 */
authRouter.post('/refresh', controller.refresh);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the session's refresh tokens and clear cookies
 *     security: []
 *     responses:
 *       200: { description: Signed out }
 */
authRouter.post('/logout', controller.logout);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Current session user
 *     responses:
 *       200:
 *         description: The signed-in user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SessionResponse' }
 *       401: { description: Not authenticated }
 */
authRouter.get('/me', requireInternalAuth(env.INTERNAL_JWT_SECRET), controller.me);
