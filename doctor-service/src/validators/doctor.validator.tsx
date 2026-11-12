import { z } from 'zod';
import { dateRangeQuerySchema, objectIdPattern, paginationQuerySchema } from '@doctor-tracker/common';

const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s().-]{7,20}$/, 'Enter a valid phone number');

export const objectIdParam = z.string().regex(objectIdPattern, 'Invalid id');

export const idParamsSchema = z.object({ id: objectIdParam });
export const doctorPatientParamsSchema = z.object({ id: objectIdParam, patientId: objectIdParam });

export const createDoctorSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  specialization: z.string().trim().min(2, 'Specialization is required').max(80),
  hospital: z.string().trim().min(2, 'Hospital is required').max(120),
  phone,
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
});

export const updateDoctorSchema = createDoctorSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

export const DOCTOR_SORTS = ['createdAt:desc', 'createdAt:asc', 'name:asc', 'name:desc'] as const;

export const listDoctorsQuerySchema = paginationQuerySchema
  .merge(dateRangeQuerySchema)
  .extend({
    search: z.string().trim().max(100).optional(),
    specialization: z.string().trim().max(80).optional(),
    hospital: z.string().trim().max(120).optional(),
    sort: z.enum(DOCTOR_SORTS).default('createdAt:desc'),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: '"from" must be before "to"', path: ['from'] });

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;

/** Patient payload accepted when adding a patient under a doctor (doctor comes from the URL). */
export const addPatientSchema = z.object({
  name: z.string().trim().min(2).max(100),
  age: z.coerce.number().int().min(0).max(130),
  gender: z.enum(['male', 'female', 'other']),
  condition: z.string().trim().min(2).max(100),
  phone,
});

/** Query for a doctor's patient list; forwarded as-is to patient-service. */
export const doctorPatientsQuerySchema = paginationQuerySchema.merge(dateRangeQuerySchema).extend({
  search: z.string().trim().max(100).optional(),
  condition: z.string().trim().max(100).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  minAge: z.coerce.number().int().min(0).max(130).optional(),
  maxAge: z.coerce.number().int().min(0).max(130).optional(),
  // Validated against the whitelist by patient-service.
  sort: z.string().max(30).optional(),
});

export const statsTrendQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', '12m']).default('30d'),
});
