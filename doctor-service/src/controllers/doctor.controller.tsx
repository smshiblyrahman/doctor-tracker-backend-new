import type { Request, Response } from 'express';
import { AppError, createdAtMatch, searchMatch, validated } from '@doctor-tracker/common';
import { Doctor, type DoctorDocument } from '../models/Doctor';
import { paginate, parseSort } from '../utils/pagination';
import { patientService } from '../clients/patientService.client';
import type { CreateDoctorInput, ListDoctorsQuery, UpdateDoctorInput } from '../validators/doctor.validator';

interface DoctorRow {
  _id: unknown;
  [key: string]: unknown;
}

const LIST_PROJECTION = { name: 1, specialization: 1, hospital: 1, phone: 1, email: 1, createdAt: 1, updatedAt: 1 };

function toDto(row: DoctorRow) {
  const { _id, ...rest } = row;
  return { id: String(_id), ...rest };
}

/** Patient counts come from patient-service; the list still renders (counts null) if it is down. */
async function withPatientCounts<T extends { id: string }>(doctors: T[]) {
  try {
    const counts = await patientService.countsByDoctor(doctors.map((d) => d.id));
    return doctors.map((d) => ({ ...d, patientCount: counts[d.id] ?? 0 }));
  } catch (err) {
    console.warn('[doctor-service] patient counts unavailable:', (err as Error).message);
    return doctors.map((d) => ({ ...d, patientCount: null }));
  }
}

/** The schema's toJSON transform adds `id`; mongoose's types do not know that. */
function serialize(doctor: DoctorDocument) {
  return doctor.toJSON() as unknown as { id: string } & Record<string, unknown>;
}

async function findDoctorOr404(id: string) {
  const doctor = await Doctor.findById(id);
  if (!doctor) throw AppError.notFound('Doctor not found');
  return doctor;
}

export async function listDoctors(req: Request, res: Response) {
  const q = validated<ListDoctorsQuery>(req, 'query');
  const match = {
    ...searchMatch(q.search),
    ...createdAtMatch(q.from, q.to),
    ...(q.specialization ? { specialization: q.specialization } : {}),
    ...(q.hospital ? { hospital: q.hospital } : {}),
  };

  const { items, pagination } = await paginate<DoctorRow>(Doctor, {
    match,
    sort: parseSort(q.sort),
    page: q.page,
    limit: q.limit,
    project: LIST_PROJECTION,
  });

  res.json({ success: true, data: await withPatientCounts(items.map(toDto)), pagination });
}

/** Distinct values for the filter dropdowns. */
export async function getFilterOptions(_req: Request, res: Response) {
  const [specializations, hospitals] = await Promise.all([
    Doctor.distinct('specialization'),
    Doctor.distinct('hospital'),
  ]);
  res.json({
    success: true,
    data: {
      specializations: (specializations as string[]).sort((a, b) => a.localeCompare(b)),
      hospitals: (hospitals as string[]).sort((a, b) => a.localeCompare(b)),
    },
  });
}

export async function createDoctor(req: Request, res: Response) {
  const doctor = await Doctor.create(req.body as CreateDoctorInput);
  res.status(201).json({ success: true, data: { ...doctor.toJSON(), patientCount: 0 } });
}

export async function getDoctor(req: Request, res: Response) {
  const { id } = validated<{ id: string }>(req, 'params');
  const doctor = await findDoctorOr404(id);
  const [withCount] = await withPatientCounts([serialize(doctor)]);
  res.json({ success: true, data: withCount });
}

export async function updateDoctor(req: Request, res: Response) {
  const { id } = validated<{ id: string }>(req, 'params');
  const doctor = await findDoctorOr404(id);
  const nameChanged = req.body.name !== undefined && req.body.name !== doctor.name;

  doctor.set(req.body as UpdateDoctorInput);
  await doctor.save();

  if (nameChanged) {
    // Patients keep a denormalized doctorName for listing; keep it in sync (eventually consistent).
    await patientService.renameDoctor(id, doctor.name).catch((err: Error) => {
      console.warn(`[doctor-service] failed to sync doctorName for ${id}:`, err.message);
    });
  }

  const [withCount] = await withPatientCounts([serialize(doctor)]);
  res.json({ success: true, data: withCount });
}

/** Deletes the doctor's patients first so no orphaned patients are left behind. */
export async function deleteDoctor(req: Request, res: Response) {
  const { id } = validated<{ id: string }>(req, 'params');
  await findDoctorOr404(id);
  const result = await patientService.deleteAllForDoctor(id);
  await Doctor.deleteOne({ _id: id });
  res.json({ success: true, data: { id, deletedPatients: result.data.deletedCount } });
}

export async function listDoctorPatients(req: Request, res: Response) {
  const { id } = validated<{ id: string }>(req, 'params');
  await findDoctorOr404(id);
  const query = validated<Record<string, unknown>>(req, 'query');
  res.json(await patientService.listForDoctor(id, query, req.auth));
}

export async function addDoctorPatient(req: Request, res: Response) {
  const { id } = validated<{ id: string }>(req, 'params');
  const doctor = await findDoctorOr404(id);
  const created = await patientService.createForDoctor({ id, name: doctor.name }, req.body);
  res.status(201).json(created);
}

export async function removeDoctorPatient(req: Request, res: Response) {
  const { id, patientId } = validated<{ id: string; patientId: string }>(req, 'params');
  await findDoctorOr404(id);
  res.json(await patientService.removeFromDoctor(id, patientId));
}
