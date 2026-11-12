import { Router } from 'express';
import { requireInternalAuth, validate } from '@doctor-tracker/common';
import { env } from '../config/env';
import * as controller from '../controllers/doctor.controller';
import {
  addPatientSchema,
  createDoctorSchema,
  doctorPatientParamsSchema,
  doctorPatientsQuerySchema,
  idParamsSchema,
  listDoctorsQuerySchema,
  updateDoctorSchema,
} from '../validators/doctor.validator';

export const doctorRouter = Router();
doctorRouter.use(requireInternalAuth(env.INTERNAL_JWT_SECRET));

/**
 * @swagger
 * tags:
 *   - name: Doctors
 *     description: Doctor records and their patients
 * components:
 *   schemas:
 *     DoctorInput:
 *       type: object
 *       required: [name, specialization, hospital, phone, email]
 *       properties:
 *         name: { type: string, example: Dr. Sarah Chen }
 *         specialization: { type: string, example: Cardiology }
 *         hospital: { type: string, example: St. Mary's Medical Center }
 *         phone: { type: string, example: "+1 555 201 3344" }
 *         email: { type: string, example: sarah.chen@stmarys.org }
 *     Doctor:
 *       allOf:
 *         - $ref: '#/components/schemas/DoctorInput'
 *         - type: object
 *           properties:
 *             id: { type: string }
 *             patientCount: { type: integer, nullable: true, description: "null if patient-service is unavailable" }
 *             createdAt: { type: string, format: date-time }
 *             updatedAt: { type: string, format: date-time }
 *     DoctorList:
 *       type: object
 *       properties:
 *         success: { type: boolean }
 *         data: { type: array, items: { $ref: '#/components/schemas/Doctor' } }
 *         pagination: { $ref: '#/components/schemas/Pagination' }
 *     NewPatientInput:
 *       type: object
 *       required: [name, age, gender, condition, phone]
 *       properties:
 *         name: { type: string, example: James Walker }
 *         age: { type: integer, example: 54 }
 *         gender: { type: string, enum: [male, female, other] }
 *         condition: { type: string, example: Hypertension }
 *         phone: { type: string, example: "+1 555 404 1212" }
 */

/**
 * @swagger
 * /api/v1/doctors:
 *   get:
 *     tags: [Doctors]
 *     summary: List doctors with prefix search, filters and pagination
 *     parameters:
 *       - { in: query, name: search, schema: { type: string }, description: "Prefix search over name, specialization, hospital, email, phone" }
 *       - { in: query, name: specialization, schema: { type: string } }
 *       - { in: query, name: hospital, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date }, description: "Created on/after (YYYY-MM-DD)" }
 *       - { in: query, name: to, schema: { type: string, format: date }, description: "Created on/before (YYYY-MM-DD)" }
 *       - { in: query, name: sort, schema: { type: string, enum: ["createdAt:desc", "createdAt:asc", "name:asc", "name:desc"] } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10, maximum: 100 } }
 *     responses:
 *       200: { description: A page of doctors, content: { application/json: { schema: { $ref: '#/components/schemas/DoctorList' } } } }
 *   post:
 *     tags: [Doctors]
 *     summary: Create a doctor
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/DoctorInput' } } }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       409: { description: Email already in use }
 */
doctorRouter.get('/', validate({ query: listDoctorsQuerySchema }), controller.listDoctors);
doctorRouter.post('/', validate({ body: createDoctorSchema }), controller.createDoctor);

/**
 * @swagger
 * /api/v1/doctors/filters:
 *   get:
 *     tags: [Doctors]
 *     summary: Distinct specializations and hospitals for filter dropdowns
 *     responses:
 *       200: { description: Filter options }
 */
doctorRouter.get('/filters', controller.getFilterOptions);

/**
 * @swagger
 * /api/v1/doctors/{id}:
 *   parameters:
 *     - { in: path, name: id, required: true, schema: { type: string } }
 *   get:
 *     tags: [Doctors]
 *     summary: Doctor detail (with patient count)
 *     responses:
 *       200: { description: Doctor }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Doctors]
 *     summary: Update a doctor
 *     requestBody:
 *       content: { application/json: { schema: { $ref: '#/components/schemas/DoctorInput' } } }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 *   delete:
 *     tags: [Doctors]
 *     summary: Delete a doctor and all of their patients
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 */
doctorRouter.get('/:id', validate({ params: idParamsSchema }), controller.getDoctor);
doctorRouter.patch('/:id', validate({ params: idParamsSchema, body: updateDoctorSchema }), controller.updateDoctor);
doctorRouter.delete('/:id', validate({ params: idParamsSchema }), controller.deleteDoctor);

/**
 * @swagger
 * /api/v1/doctors/{id}/patients:
 *   parameters:
 *     - { in: path, name: id, required: true, schema: { type: string } }
 *   get:
 *     tags: [Doctors]
 *     summary: Paginated patients of a doctor (served by patient-service)
 *     parameters:
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: condition, schema: { type: string } }
 *       - { in: query, name: gender, schema: { type: string, enum: [male, female, other] } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *     responses:
 *       200: { description: A page of patients }
 *   post:
 *     tags: [Doctors]
 *     summary: Add a new patient under this doctor
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/NewPatientInput' } } }
 *     responses:
 *       201: { description: Patient created }
 * /api/v1/doctors/{id}/patients/{patientId}:
 *   delete:
 *     tags: [Doctors]
 *     summary: Remove a patient from this doctor's list
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: patientId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Patient removed }
 *       404: { description: Doctor or patient not found }
 */
doctorRouter.get(
  '/:id/patients',
  validate({ params: idParamsSchema, query: doctorPatientsQuerySchema }),
  controller.listDoctorPatients,
);
doctorRouter.post(
  '/:id/patients',
  validate({ params: idParamsSchema, body: addPatientSchema }),
  controller.addDoctorPatient,
);
doctorRouter.delete(
  '/:id/patients/:patientId',
  validate({ params: doctorPatientParamsSchema }),
  controller.removeDoctorPatient,
);
