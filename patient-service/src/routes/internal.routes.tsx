import { Router } from 'express';
import { requireInternalAuth, validate } from '@doctor-tracker/common';
import { env } from '../config/env';
import * as controller from '../controllers/patient.controller';
import * as stats from '../controllers/stats.controller';
import {
  countsBodySchema,
  createPatientSchema,
  doctorIdParamsSchema,
  idParamsSchema,
  limitQuerySchema,
  removeForDoctorQuerySchema,
  renameDoctorBodySchema,
  trendQuerySchema,
} from '../validators/patient.validator';

/**
 * Service-to-service endpoints. The gateway never routes `/internal/*`; mutating
 * endpoints accept a forwarded user identity (doctor-service passes the caller
 * through), stats endpoints are restricted to service identities.
 */
export const internalRouter = Router();
internalRouter.use(requireInternalAuth(env.INTERNAL_JWT_SECRET));
const serviceOnly = requireInternalAuth(env.INTERNAL_JWT_SECRET, { serviceOnly: true });

/**
 * @swagger
 * tags:
 *   - name: Internal
 *     description: Service-to-service endpoints (not exposed through the gateway)
 * /internal/patients:
 *   post:
 *     tags: [Internal]
 *     summary: Create a patient for a verified doctor (called by doctor-service)
 *     responses: { 201: { description: Created } }
 * /internal/patients/{id}:
 *   delete:
 *     tags: [Internal]
 *     summary: Delete a patient if it belongs to the given doctor
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: query, name: doctor, required: true, schema: { type: string } }
 *     responses: { 200: { description: Deleted }, 404: { description: Not in this doctor's list } }
 * /internal/patients/counts:
 *   post:
 *     tags: [Internal]
 *     summary: Patient counts keyed by doctor id
 *     responses: { 200: { description: Counts } }
 * /internal/patients/by-doctor/{doctorId}:
 *   patch:
 *     tags: [Internal]
 *     summary: Sync the denormalized doctorName after a doctor is renamed
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Internal]
 *     summary: Delete all patients of a doctor (doctor deletion cascade)
 *     responses: { 200: { description: Deleted } }
 * /internal/patients/stats/summary:
 *   get: { tags: [Internal], summary: Totals, growth and gender split, responses: { 200: { description: Summary } } }
 * /internal/patients/stats/per-doctor:
 *   get: { tags: [Internal], summary: Top doctors by patient count, responses: { 200: { description: Rows } } }
 * /internal/patients/stats/trends:
 *   get: { tags: [Internal], summary: Patients registered per bucket, responses: { 200: { description: Series } } }
 * /internal/patients/stats/conditions:
 *   get: { tags: [Internal], summary: Most common conditions, responses: { 200: { description: Rows } } }
 * /internal/patients/stats/recent:
 *   get: { tags: [Internal], summary: Most recently added patients, responses: { 200: { description: Rows } } }
 */
internalRouter.post('/', serviceOnly, validate({ body: createPatientSchema }), controller.createPatient);
internalRouter.post('/counts', serviceOnly, validate({ body: countsBodySchema }), controller.countsByDoctor);

internalRouter.get('/stats/summary', serviceOnly, stats.patientSummary);
internalRouter.get('/stats/per-doctor', serviceOnly, validate({ query: limitQuerySchema }), stats.patientsPerDoctor);
internalRouter.get('/stats/trends', serviceOnly, validate({ query: trendQuerySchema }), stats.patientTrends);
internalRouter.get('/stats/conditions', serviceOnly, validate({ query: limitQuerySchema }), stats.conditionBreakdown);
internalRouter.get('/stats/recent', serviceOnly, validate({ query: limitQuerySchema }), stats.recentPatients);

internalRouter.patch(
  '/by-doctor/:doctorId',
  serviceOnly,
  validate({ params: doctorIdParamsSchema, body: renameDoctorBodySchema }),
  controller.renameDoctor,
);
internalRouter.delete(
  '/by-doctor/:doctorId',
  serviceOnly,
  validate({ params: doctorIdParamsSchema }),
  controller.deleteByDoctor,
);
internalRouter.delete(
  '/:id',
  serviceOnly,
  validate({ params: idParamsSchema, query: removeForDoctorQuerySchema }),
  controller.removeForDoctor,
);
