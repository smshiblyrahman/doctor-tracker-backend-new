import { Router } from 'express';
import { z } from 'zod';
import { requireInternalAuth, trendRangeSchema, validate } from '@doctor-tracker/common';
import { env } from '../config/env';
import * as controller from '../controllers/dashboard.controller';

export const dashboardRouter = Router();
dashboardRouter.use(requireInternalAuth(env.INTERNAL_JWT_SECRET));

const limitQuery = (fallback: number) =>
  z.object({ limit: z.coerce.number().int().min(1).max(50).default(fallback) });

/**
 * @swagger
 * tags:
 *   - name: Dashboard
 *     description: Pre-aggregated analytics composed from doctor-service and patient-service
 * /api/v1/dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Headline KPIs (totals, averages, month-over-month growth, gender split)
 *     responses:
 *       200:
 *         description: Summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalDoctors: { type: integer }
 *                     totalPatients: { type: integer }
 *                     avgPatientsPerDoctor: { type: number }
 *                     averagePatientAge: { type: number }
 *                     newDoctorsThisMonth: { type: integer }
 *                     newPatientsThisMonth: { type: integer }
 *                     doctorGrowthPct: { type: number, nullable: true }
 *                     patientGrowthPct: { type: number, nullable: true }
 *                     genders: { type: array, items: { type: object, properties: { gender: { type: string }, count: { type: integer } } } }
 * /api/v1/dashboard/patients-per-doctor:
 *   get:
 *     tags: [Dashboard]
 *     summary: Doctors ranked by patient count (top N)
 *     parameters:
 *       - { in: query, name: limit, schema: { type: integer, default: 10, maximum: 50 } }
 *     responses: { 200: { description: Ranked rows } }
 * /api/v1/dashboard/trends:
 *   get:
 *     tags: [Dashboard]
 *     summary: Doctor and patient registrations over time (zero-filled buckets)
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: [7d, 30d, 90d, 12m], default: 30d } }
 *     responses: { 200: { description: Time series } }
 * /api/v1/dashboard/conditions:
 *   get:
 *     tags: [Dashboard]
 *     summary: Most common patient conditions (long tail rolled into "Other")
 *     parameters:
 *       - { in: query, name: limit, schema: { type: integer, default: 6 } }
 *     responses: { 200: { description: Distribution } }
 * /api/v1/dashboard/specializations:
 *   get:
 *     tags: [Dashboard]
 *     summary: Doctors per specialization
 *     responses: { 200: { description: Distribution } }
 * /api/v1/dashboard/recent-patients:
 *   get:
 *     tags: [Dashboard]
 *     summary: Most recently added patients
 *     parameters:
 *       - { in: query, name: limit, schema: { type: integer, default: 8 } }
 *     responses: { 200: { description: Patients } }
 */
dashboardRouter.get('/summary', controller.getSummary);
dashboardRouter.get('/patients-per-doctor', validate({ query: limitQuery(10) }), controller.getPatientsPerDoctor);
dashboardRouter.get('/trends', validate({ query: z.object({ range: trendRangeSchema }) }), controller.getTrends);
dashboardRouter.get('/conditions', validate({ query: limitQuery(6) }), controller.getConditions);
dashboardRouter.get('/specializations', controller.getSpecializations);
dashboardRouter.get('/recent-patients', validate({ query: limitQuery(8) }), controller.getRecentPatients);
