import { Router } from 'express';
import { requireInternalAuth, validate } from '@doctor-tracker/common';
import { env } from '../config/env';
import * as controller from '../controllers/patient.controller';
import { idParamsSchema, listPatientsQuerySchema, updatePatientSchema } from '../validators/patient.validator';

export const patientRouter = Router();
patientRouter.use(requireInternalAuth(env.INTERNAL_JWT_SECRET));

/**
 * @swagger
 * tags:
 *   - name: Patients
 *     description: Patient records. New patients are added under a doctor (POST /api/v1/doctors/{id}/patients).
 * components:
 *   schemas:
 *     Patient:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         name: { type: string, example: James Walker }
 *         age: { type: integer, example: 54 }
 *         gender: { type: string, enum: [male, female, other] }
 *         condition: { type: string, example: Hypertension }
 *         phone: { type: string, example: "+1 555 404 1212" }
 *         doctor: { type: string, description: Doctor id }
 *         doctorName: { type: string, example: Dr. Sarah Chen }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     PatientUpdate:
 *       type: object
 *       properties:
 *         name: { type: string }
 *         age: { type: integer }
 *         gender: { type: string, enum: [male, female, other] }
 *         condition: { type: string }
 *         phone: { type: string }
 *     PatientList:
 *       type: object
 *       properties:
 *         success: { type: boolean }
 *         data: { type: array, items: { $ref: '#/components/schemas/Patient' } }
 *         pagination: { $ref: '#/components/schemas/Pagination' }
 */

/**
 * @swagger
 * /api/v1/patients:
 *   get:
 *     tags: [Patients]
 *     summary: List patients with prefix search, filters and pagination
 *     parameters:
 *       - { in: query, name: search, schema: { type: string }, description: "Prefix search over name, condition, phone" }
 *       - { in: query, name: condition, schema: { type: string } }
 *       - { in: query, name: gender, schema: { type: string, enum: [male, female, other] } }
 *       - { in: query, name: doctor, schema: { type: string }, description: Doctor id }
 *       - { in: query, name: minAge, schema: { type: integer } }
 *       - { in: query, name: maxAge, schema: { type: integer } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *       - { in: query, name: sort, schema: { type: string, enum: ["createdAt:desc", "createdAt:asc", "name:asc", "name:desc", "age:asc", "age:desc"] } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10, maximum: 100 } }
 *     responses:
 *       200: { description: A page of patients, content: { application/json: { schema: { $ref: '#/components/schemas/PatientList' } } } }
 */
patientRouter.get('/', validate({ query: listPatientsQuerySchema }), controller.listPatients);

/**
 * @swagger
 * /api/v1/patients/filters:
 *   get:
 *     tags: [Patients]
 *     summary: Distinct conditions for filter dropdowns
 *     parameters:
 *       - { in: query, name: doctor, schema: { type: string }, description: Scope to one doctor }
 *     responses:
 *       200: { description: Filter options }
 */
patientRouter.get('/filters', controller.getFilterOptions);

/**
 * @swagger
 * /api/v1/patients/{id}:
 *   parameters:
 *     - { in: path, name: id, required: true, schema: { type: string } }
 *   get:
 *     tags: [Patients]
 *     summary: Patient detail
 *     responses:
 *       200: { description: Patient }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Patients]
 *     summary: Edit patient information
 *     requestBody:
 *       content: { application/json: { schema: { $ref: '#/components/schemas/PatientUpdate' } } }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 *   delete:
 *     tags: [Patients]
 *     summary: Delete a patient
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 */
patientRouter.get('/:id', validate({ params: idParamsSchema }), controller.getPatient);
patientRouter.patch('/:id', validate({ params: idParamsSchema, body: updatePatientSchema }), controller.updatePatient);
patientRouter.delete('/:id', validate({ params: idParamsSchema }), controller.deletePatient);
