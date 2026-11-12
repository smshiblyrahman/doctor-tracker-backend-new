import './env';

import request from 'supertest';
import { AppError, INTERNAL_AUTH_HEADER, signInternalToken } from '@doctor-tracker/common';
import { createApp } from '../src/app';
import { cache, growthPercent } from '../src/controllers/dashboard.controller';
import { doctorService } from '../src/clients/doctorService.client';
import { patientService } from '../src/clients/patientService.client';

jest.mock('../src/clients/doctorService.client', () => ({
  doctorService: { summary: jest.fn(), trends: jest.fn(), specializations: jest.fn() },
}));
jest.mock('../src/clients/patientService.client', () => ({
  patientService: { summary: jest.fn(), perDoctor: jest.fn(), trends: jest.fn(), conditions: jest.fn(), recent: jest.fn() },
}));
const doctors = doctorService as jest.Mocked<typeof doctorService>;
const patients = patientService as jest.Mocked<typeof patientService>;

const app = createApp();
const token = signInternalToken({ kind: 'user', sub: 'u1', role: 'admin' }, process.env.INTERNAL_JWT_SECRET!);
const get = (url: string) => request(app).get(url).set(INTERNAL_AUTH_HEADER, token);

beforeEach(() => {
  jest.clearAllMocks();
  cache.clear();
  doctors.summary.mockResolvedValue({ total: 4, newThisMonth: 2, newLastMonth: 1 });
  patients.summary.mockResolvedValue({ total: 30, newThisMonth: 10, newLastMonth: 0, averageAge: 44.5, genders: [] });
});

describe('dashboard-service', () => {
  it('composes the summary from both services', async () => {
    const res = await get('/api/v1/dashboard/summary').expect(200);
    expect(res.body.data).toMatchObject({
      totalDoctors: 4,
      totalPatients: 30,
      avgPatientsPerDoctor: 7.5,
      doctorGrowthPct: 100,
      patientGrowthPct: null,
    });
  });

  it('caches composed responses and does not cache failures', async () => {
    await get('/api/v1/dashboard/summary');
    await get('/api/v1/dashboard/summary');
    expect(doctors.summary).toHaveBeenCalledTimes(1);

    cache.clear();
    doctors.summary.mockRejectedValueOnce(AppError.badGateway('Doctor service is unavailable'));
    await get('/api/v1/dashboard/summary').expect(502);
    await get('/api/v1/dashboard/summary').expect(200);
  });

  it('merges doctor and patient trends onto one axis', async () => {
    doctors.trends.mockResolvedValue({ range: '7d', unit: 'day', series: [{ bucket: 'd1', count: 1 }, { bucket: 'd2', count: 0 }] });
    patients.trends.mockResolvedValue({ range: '7d', unit: 'day', series: [{ bucket: 'd1', count: 5 }, { bucket: 'd2', count: 7 }] });
    const res = await get('/api/v1/dashboard/trends?range=7d').expect(200);
    expect(res.body.data.series).toEqual([
      { date: 'd1', patients: 5, doctors: 1 },
      { date: 'd2', patients: 7, doctors: 0 },
    ]);
  });

  it('validates the range', async () => {
    await get('/api/v1/dashboard/trends?range=5y').expect(400);
  });

  it('computes growth percentages', () => {
    expect(growthPercent(15, 10)).toBe(50);
    expect(growthPercent(0, 0)).toBe(0);
    expect(growthPercent(3, 0)).toBeNull();
  });
});
