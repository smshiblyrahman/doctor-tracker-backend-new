import { Types } from 'mongoose';
import type { Request, Response } from 'express';
import { AppError, createdAtMatch, searchMatch, validated } from '@doctor-tracker/common';
import { Patient } from '../models/Patient';
import { paginate, parseSort } from '../utils/pagination';
import type { CreatePatientInput, ListPatientsQuery, UpdatePatientInput } from '../validators/patient.validator';

const LIST_PROJECTION = {
  name: 1,
  age: 1,
  gender: 1,
  condition: 1,
  phone: 1,
  doctor: 1,
  doctorName: 1,
  createdAt: 1,
  updatedAt: 1,
};

function toDto(row: Record<string, any>) {
  const { _id, doctor, ...rest } = row;
  return { id: String(_id), doctor: String(doctor), ...rest };
}

export function buildPatientMatch(q: ListPatientsQuery): Record<string, unknown> {
  const match: Record<string, unknown> = {
    ...searchMatch(q.search),
    ...createdAtMatch(q.from, q.to),
  };
  if (q.doctor) match.doctor = new Types.ObjectId(q.doctor);
  if (q.condition) match.condition = q.condition;
  if (q.gender) match.gender = q.gender;
  if (q.minAge !== undefined || q.maxAge !== undefined) {
    match.age = {
      ...(q.minAge !== undefined ? { $gte: q.minAge } : {}),
      ...(q.maxAge !== undefined ? { $lte: q.maxAge } : {}),
    };
  }
  return match;
}

export async function listPatients(req: Request, res: Response) {
  const q = validated<ListPatientsQuery>(req, 'query');
  const { items, pagination } = await paginate<Record<string, any>>(Patient, {
    match: buildPatientMatch(q),
    sort: parseSort(q.sort),
    page: q.page,
    limit: q.limit,
    project: LIST_PROJECTION,
  });
  res.json({ success: true, data: items.map(toDto), pagination });
}

/** Distinct conditions for the filter dropdown (optionally scoped to one doctor). */
export async function getFilterOptions(req: Request, res: Response) {
  const doctor = typeof req.query.doctor === 'string' && Types.ObjectId.isValid(req.query.doctor)
    ? { doctor: new Types.ObjectId(req.query.doctor) }
    : {};
  const conditions = (await Patient.distinct('condition', doctor)) as string[];
  res.json({ success: true, data: { conditions: conditions.sort((a, b) => a.localeCompare(b)) } });
}

export async function getPatient(req: Request, res: Response) {
  const { id } = validated<{ id: string }>(req, 'params');
  const patient = await Patient.findById(id);
  if (!patient) throw AppError.notFound('Patient not found');
  res.json({ success: true, data: patient.toJSON() });
}

export async function updatePatient(req: Request, res: Response) {
  const { id } = validated<{ id: string }>(req, 'params');
  const patient = await Patient.findById(id);
  if (!patient) throw AppError.notFound('Patient not found');
  patient.set(req.body as UpdatePatientInput);
  await patient.save();
  res.json({ success: true, data: patient.toJSON() });
}

export async function deletePatient(req: Request, res: Response) {
  const { id } = validated<{ id: string }>(req, 'params');
  const deleted = await Patient.findByIdAndDelete(id);
  if (!deleted) throw AppError.notFound('Patient not found');
  res.json({ success: true, data: { id } });
}

// ---- Internal (called by doctor-service) -------------------------------------------------

export async function createPatient(req: Request, res: Response) {
  const patient = await Patient.create(req.body as CreatePatientInput);
  res.status(201).json({ success: true, data: patient.toJSON() });
}

/** Removes a patient only if it belongs to the given doctor. */
export async function removeForDoctor(req: Request, res: Response) {
  const { id } = validated<{ id: string }>(req, 'params');
  const { doctor } = validated<{ doctor: string }>(req, 'query');
  const deleted = await Patient.findOneAndDelete({ _id: id, doctor });
  if (!deleted) throw AppError.notFound("Patient not found in this doctor's list");
  res.json({ success: true, data: { id } });
}

/** Patient counts for a page of doctors; one indexed $group instead of N count queries. */
export async function countsByDoctor(req: Request, res: Response) {
  const { doctorIds } = req.body as { doctorIds: string[] };
  const rows = await Patient.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { doctor: { $in: doctorIds.map((id) => new Types.ObjectId(id)) } } },
    { $group: { _id: '$doctor', count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
  res.json({ success: true, data: counts });
}

export async function renameDoctor(req: Request, res: Response) {
  const { doctorId } = validated<{ doctorId: string }>(req, 'params');
  const { doctorName } = req.body as { doctorName: string };
  const result = await Patient.updateMany({ doctor: doctorId }, { $set: { doctorName } });
  res.json({ success: true, data: { modifiedCount: result.modifiedCount } });
}

export async function deleteByDoctor(req: Request, res: Response) {
  const { doctorId } = validated<{ doctorId: string }>(req, 'params');
  const result = await Patient.deleteMany({ doctor: doctorId });
  res.json({ success: true, data: { deletedCount: result.deletedCount } });
}
