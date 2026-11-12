import './env';

import request from 'supertest';
import { Types } from 'mongoose';
import { INTERNAL_AUTH_HEADER, signInternalToken } from '@doctor-tracker/common';
import { clearDb, startTestDb } from '../../packages/common/tests/testDb';
import { createApp } from '../src/app';
import { Patient } from '../src/models/Patient';

const app = createApp();
const secret = process.env.INTERNAL_JWT_SECRET!;
const userToken = signInternalToken({ kind: 'user', sub: 'u1', role: 'admin' }, secret);
const serviceToken = signInternalToken({ kind: 'service', sub: 'doctor-service' }, secret);
const as = (token: string) => ({
  get: (url: string) => request(app).get(url).set(INTERNAL_AUTH_HEADER, token),
  post: (url: string) => request(app).post(url).set(INTERNAL_AUTH_HEADER, token),
  patch: (url: string) => request(app).patch(url).set(INTERNAL_AUTH_HEADER, token),
  delete: (url: string) => request(app).delete(url).set(INTERNAL_AUTH_HEADER, token),
});
const user = as(userToken);
const service = as(serviceToken);

const drA = new Types.ObjectId();
const drB = new Types.ObjectId();
const seed = [
  { name: 'Alice Walker', age: 62, gender: 'female', condition: 'Hypertension', doctor: drA, doctorName: 'Dr. A' },
  { name: 'Bob Stone', age: 35, gender: 'male', condition: 'Asthma', doctor: drA, doctorName: 'Dr. A' },
  { name: 'Carla Diaz', age: 71, gender: 'female', condition: 'Hypertension', doctor: drB, doctorName: 'Dr. B' },
];

let stopDb: () => Promise<void>;
beforeAll(async () => {
  stopDb = await startTestDb();
  await Patient.init();
});
afterAll(() => stopDb());
beforeEach(async () => {
  await clearDb();
  for (const p of seed) await new Patient({ ...p, phone: '+1 555 404 1212' }).save();
});

describe('patient-service public API', () => {
  it('filters by condition, gender and age range together', async () => {
    const res = await user.get('/api/v1/patients?condition=Hypertension&gender=female&minAge=65').expect(200);
    expect(res.body.data.map((p: any) => p.name)).toEqual(['Carla Diaz']);
    expect(res.body.pagination.total).toBe(1);
  });

  it('scopes to one doctor and sorts by age', async () => {
    const res = await user.get(`/api/v1/patients?doctor=${drA}&sort=age:asc`).expect(200);
    expect(res.body.data.map((p: any) => p.age)).toEqual([35, 62]);
  });

  it('rejects inconsistent ranges', async () => {
    await user.get('/api/v1/patients?minAge=60&maxAge=20').expect(400);
    await user.get('/api/v1/patients?from=2026-05-01&to=2026-01-01').expect(400);
  });

  it('edits allowed fields, refreshes search tokens, and refuses doctor reassignment', async () => {
    const bob = await Patient.findOne({ name: 'Bob Stone' });
    await user.patch(`/api/v1/patients/${bob!._id}`).send({ condition: 'Bronchitis' }).expect(200);
    const found = await user.get('/api/v1/patients?search=bronch').expect(200);
    expect(found.body.data).toHaveLength(1);
    await user.patch(`/api/v1/patients/${bob!._id}`).send({ doctor: String(drB) }).expect(400);
  });

  it('deletes a patient and 404s afterwards', async () => {
    const bob = await Patient.findOne({ name: 'Bob Stone' });
    await user.delete(`/api/v1/patients/${bob!._id}`).expect(200);
    await user.get(`/api/v1/patients/${bob!._id}`).expect(404);
  });
});

describe('patient-service internal API', () => {
  it('is closed to end-user identities', async () => {
    await user.post('/internal/patients/counts').send({ doctorIds: [] }).expect(403);
  });

  it('creates patients for a doctor', async () => {
    const res = await service
      .post('/internal/patients')
      .send({ name: 'Dan Ray', age: 50, gender: 'male', condition: 'Gout', phone: '+1 555 000 0000', doctor: String(drB), doctorName: 'Dr. B' })
      .expect(201);
    expect(res.body.data).toMatchObject({ doctor: String(drB), doctorName: 'Dr. B' });
  });

  it('only removes a patient from the doctor that owns it', async () => {
    const alice = await Patient.findOne({ name: 'Alice Walker' });
    await service.delete(`/internal/patients/${alice!._id}?doctor=${drB}`).expect(404);
    await service.delete(`/internal/patients/${alice!._id}?doctor=${drA}`).expect(200);
  });

  it('counts patients per doctor in one call', async () => {
    const res = await service.post('/internal/patients/counts').send({ doctorIds: [String(drA), String(drB)] }).expect(200);
    expect(res.body.data).toEqual({ [String(drA)]: 2, [String(drB)]: 1 });
  });

  it('syncs doctor renames and cascades doctor deletion', async () => {
    await service.patch(`/internal/patients/by-doctor/${drA}`).send({ doctorName: 'Dr. Renamed' }).expect(200);
    expect(await Patient.countDocuments({ doctorName: 'Dr. Renamed' })).toBe(2);
    const res = await service.delete(`/internal/patients/by-doctor/${drA}`).expect(200);
    expect(res.body.data.deletedCount).toBe(2);
  });

  it('aggregates stats for the dashboard', async () => {
    const perDoctor = await service.get('/internal/patients/stats/per-doctor?limit=5').expect(200);
    expect(perDoctor.body.data.items[0]).toMatchObject({ doctorId: String(drA), doctorName: 'Dr. A', count: 2 });

    const conditions = await service.get('/internal/patients/stats/conditions?limit=1').expect(200);
    expect(conditions.body.data).toEqual([
      { condition: 'Hypertension', count: 2 },
      { condition: 'Other', count: 1 },
    ]);

    const trends = await service.get('/internal/patients/stats/trends?range=7d').expect(200);
    expect(trends.body.data.series).toHaveLength(7);
    expect(trends.body.data.series.at(-1).count).toBe(3);

    const summary = await service.get('/internal/patients/stats/summary').expect(200);
    expect(summary.body.data).toMatchObject({ total: 3, newThisMonth: 3, averageAge: 56 });
  });
});
