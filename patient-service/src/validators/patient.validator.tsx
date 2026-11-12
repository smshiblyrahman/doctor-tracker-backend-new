import { z } from 'zod';
import { dateRangeQuerySchema, objectIdPattern, paginationQuerySchema } from '@doctor-tracker/common';
import { GENDERS } from '../models/Patient';

const objectId = z.string().regex(objectIdPattern, 'Invalid id');
const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s().-]{7,20}$/, 'Enter a valid phone number');

export const idParamsSchema = z.object({ id: objectId });
export const doctorIdParamsSchema = z.object({ doctorId: objectId });

const patientFields = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  age: z.coerce.number().int().min(0, 'Age must be 0 or more').max(130, 'Age must be 130 or less'),
  gender: z.enum(GENDERS),
  condition: z.string().trim().min(2, 'Condition is required').max(100),
  phone,
};

/** Internal: doctor-service creates patients after verifying the doctor exists. */
export const createPatientSchema = z.object({
  ...patientFields,
  doctor: objectId,
  doctorName: z.string().trim().min(1).max(100),
});

/** Reassigning a patient to another doctor is not supported; patients are added under a doctor. */
export const updatePatientSchema = z
  .object(patientFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

export const PATIENT_SORTS = ['createdAt:desc', 'createdAt:asc', 'name:asc', 'name:desc', 'age:asc', 'age:desc'] as const;

export const listPatientsQuerySchema = paginationQuerySchema
  .merge(dateRangeQuerySchema)
  .extend({
    search: z.string().trim().max(100).optional(),
    condition: z.string().trim().max(100).optional(),
    gender: z.enum(GENDERS).optional(),
    doctor: objectId.optional(),
    minAge: z.coerce.number().int().min(0).max(130).optional(),
    maxAge: z.coerce.number().int().min(0).max(130).optional(),
    sort: z.enum(PATIENT_SORTS).default('createdAt:desc'),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: '"from" must be before "to"', path: ['from'] })
  .refine((q) => q.minAge === undefined || q.maxAge === undefined || q.minAge <= q.maxAge, {
    message: '"minAge" must not exceed "maxAge"',
    path: ['minAge'],
  });

export const removeForDoctorQuerySchema = z.object({ doctor: objectId });
export const countsBodySchema = z.object({ doctorIds: z.array(objectId).max(200) });
export const renameDoctorBodySchema = z.object({ doctorName: z.string().trim().min(1).max(100) });
export const trendQuerySchema = z.object({ range: z.enum(['7d', '30d', '90d', '12m']).default('30d') });
export const limitQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;
