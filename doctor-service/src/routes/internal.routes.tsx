import { Router } from 'express';
import { requireInternalAuth, validate } from '@doctor-tracker/common';
import { env } from '../config/env';
import * as stats from '../controllers/stats.controller';
import { statsTrendQuerySchema } from '../validators/doctor.validator';

/** Service-to-service endpoints. Not routed by the API gateway. */
export const internalRouter = Router();
internalRouter.use(requireInternalAuth(env.INTERNAL_JWT_SECRET, { serviceOnly: true }));

/**
 * @swagger
 * tags:
 *   - name: Internal
 *     description: Service-to-service endpoints (not exposed through the gateway)
 * /internal/doctors/stats/summary:
 *   get:
 *     tags: [Internal]
 *     summary: Total doctors and new doctors this/last month
 *     responses: { 200: { description: Summary } }
 * /internal/doctors/stats/trends:
 *   get:
 *     tags: [Internal]
 *     summary: Doctors registered per bucket
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: [7d, 30d, 90d, 12m] } }
 *     responses: { 200: { description: Zero-filled series } }
 * /internal/doctors/stats/specializations:
 *   get:
 *     tags: [Internal]
 *     summary: Doctors per specialization
 *     responses: { 200: { description: Breakdown } }
 */
internalRouter.get('/stats/summary', stats.doctorSummary);
internalRouter.get('/stats/trends', validate({ query: statsTrendQuerySchema }), stats.doctorTrends);
internalRouter.get('/stats/specializations', stats.specializationBreakdown);
