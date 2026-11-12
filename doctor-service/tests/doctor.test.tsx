import './env';

import request from 'supertest';
import { AppError, INTERNAL_AUTH_HEADER, signInternalToken } from '@doctor-tracker/common';
import { clearDb, startTestDb } from '../../packages/common/tests/testDb';
import { patientService } from '../src/clients/patientService.client';
import { createApp } from '../src/app';
import { Doctor } from '../src/models/Doctor';

jest.mock('../src/clients/patientService.client', () => ({
  patientService: {
    countsByDoctor: jest.fn(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 3]))),
    listForDoctor: jest.fn(),
    createForDoctor: jest.fn(),
    removeFromDoctor: jest.fn(),
    renameDoctor: jest.fn(async () => ({})),
    deleteAllForDoctor: jest.fn(async () => ({ success: true, data: { deletedCount: 2 } })),
  },
}));
const mocked = patientService as jest.Mocked<typeof patientService>;

const app = createApp();
const token = signInternalToken({ kind: 'user', sub: 'u1', role: 'admin' }, process.env.INTERNAL_JWT_SECRET!);
const api = {
  get: (url: string) => request(app).get(url).set(INTERNAL_AUTH_HEADER, token),
  post: (url: string) => request(app).post(url).set(INTERNAL_AUTH_HEADER, token),
  patch: (url: string) => request(app).patch(url).set(INTERNAL_AUTH_HEADER, token),
  delete: (url: string) => request(app).delete(url).set(INTERNAL_AUTH_HEADER, token),
};

const base = { hospital: "St. Mary's", phone: '+1 555 201 3344' };
const doctors = [
  { name: 'Dr. Sarah Chen', specialization: 'Cardiology', email: 'sarah@x.org', createdAt: new Date('2026-01-10') },
  { name: 'Dr. John Smith', specialization: 'Neurology', email: 'john@x.org', createdAt: new Date('2026-02-10') },
  { name: 'Dr. Johanna Lee', specialization: 'Cardiology', email: 'jo@x.org', createdAt: new Date('2026-03-10') },
];

let stopDb: () => Promise<void>;
beforeAll(async () => {
  stopDb = await startTestDb();
  await Doctor.init();
});
afterAll(() => stopDb());
beforeEach(async () => {
  await clearDb();
  jest.clearAllMocks();
  for (const d of doctors) {
    const doc = new Doctor({ ...base, ...d });
    await doc.save();
    await Doctor.updateOne({ _id: doc._id }, { $set: { createdAt: d.createdAt } }, { timestamps: false });
  }
});

describe('doctor-service', () => {
  it('rejects calls without an internal token', async () => {
    await request(app).get('/api/v1/doctors').expect(401);
  });

  it('lists newest first with pagination metadata and patient counts', async () => {
    const res = await api.get('/api/v1/doctors?limit=2').expect(200);
    expect(res.body.data.map((d: any) => d.name)).toEqual(['Dr. Johanna Lee', 'Dr. John Smith']);
    expect(res.body.data[0].patientCount).toBe(3);
    expect(res.body.data[0].searchTokens).toBeUndefined();
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2, hasNextPage: true });
  });

  it('matches name prefixes in any word ("joh" → John and Johanna)', async () => {
    const res = await api.get('/api/v1/doctors?search=joh&sort=name:asc').expect(200);
    expect(res.body.data.map((d: any) => d.name)).toEqual(['Dr. Johanna Lee', 'Dr. John Smith']);
  });

  it('combines search, specialization and date filters', async () => {
    const res = await api.get('/api/v1/doctors?specialization=Cardiology&from=2026-03-01&to=2026-03-31').expect(200);
    expect(res.body.data.map((d: any) => d.name)).toEqual(['Dr. Johanna Lee']);
  });

  it('still lists doctors when patient-service is down (counts become null)', async () => {
    mocked.countsByDoctor.mockRejectedValueOnce(AppError.badGateway('down'));
    const res = await api.get('/api/v1/doctors').expect(200);
    expect(res.body.data[0].patientCount).toBeNull();
  });

  it('validates input and reports duplicate emails as 409', async () => {
    const bad = await api.post('/api/v1/doctors').send({ name: 'X', email: 'bad' }).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    const dup = await api
      .post('/api/v1/doctors')
      .send({ ...base, name: 'Dr. Other', specialization: 'Oncology', email: 'SARAH@x.org' })
      .expect(409);
    expect(dup.body.error.code).toBe('CONFLICT');
  });

  it('keeps search tokens in sync on update and syncs the name to patient-service', async () => {
    const doc = await Doctor.findOne({ email: 'sarah@x.org' });
    await api.patch(`/api/v1/doctors/${doc!._id}`).send({ name: 'Dr. Sarah Okafor' }).expect(200);
    expect(mocked.renameDoctor).toHaveBeenCalledWith(String(doc!._id), 'Dr. Sarah Okafor');
    const res = await api.get('/api/v1/doctors?search=okaf').expect(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 400 for malformed ids and 404 for unknown doctors', async () => {
    await api.get('/api/v1/doctors/not-an-id').expect(400);
    await api.get('/api/v1/doctors/507f1f77bcf86cd799439011').expect(404);
  });

  it('deletes the doctor after cascading to their patients', async () => {
    const doc = await Doctor.findOne({ email: 'john@x.org' });
    const res = await api.delete(`/api/v1/doctors/${doc!._id}`).expect(200);
    expect(mocked.deleteAllForDoctor).toHaveBeenCalledWith(String(doc!._id));
    expect(res.body.data.deletedPatients).toBe(2);
    expect(await Doctor.exists({ _id: doc!._id })).toBeNull();
  });

  it('keeps the doctor if deleting their patients fails', async () => {
    mocked.deleteAllForDoctor.mockRejectedValueOnce(AppError.badGateway('Patient service is unavailable'));
    const doc = await Doctor.findOne({ email: 'john@x.org' });
    await api.delete(`/api/v1/doctors/${doc!._id}`).expect(502);
    expect(await Doctor.exists({ _id: doc!._id })).not.toBeNull();
  });

  it('adds a patient under an existing doctor with the doctor name attached', async () => {
    mocked.createForDoctor.mockResolvedValueOnce({ success: true, data: { id: 'p1' } });
    const doc = await Doctor.findOne({ email: 'sarah@x.org' });
    const patient = { name: 'Pat Example', age: 40, gender: 'female', condition: 'Migraine', phone: '+1 555 123 4567' };
    await api.post(`/api/v1/doctors/${doc!._id}/patients`).send(patient).expect(201);
    expect(mocked.createForDoctor).toHaveBeenCalledWith({ id: String(doc!._id), name: 'Dr. Sarah Chen' }, patient);
  });
});
