import type { Request, Response } from 'express';
import { validated, type TrendRange } from '@doctor-tracker/common';
import { env } from '../config/env';
import { doctorService } from '../clients/doctorService.client';
import { patientService } from '../clients/patientService.client';
import { createTtlCache } from '../utils/cache';

export const cache = createTtlCache(env.CACHE_TTL_SECONDS);

/** Percentage change, or null when there is no baseline to compare against. */
export function growthPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function buildSummary() {
  const [doctors, patients] = await Promise.all([doctorService.summary(), patientService.summary()]);
  return {
    totalDoctors: doctors.total,
    totalPatients: patients.total,
    avgPatientsPerDoctor: doctors.total ? Math.round((patients.total / doctors.total) * 10) / 10 : 0,
    averagePatientAge: patients.averageAge,
    newDoctorsThisMonth: doctors.newThisMonth,
    newPatientsThisMonth: patients.newThisMonth,
    doctorGrowthPct: growthPercent(doctors.newThisMonth, doctors.newLastMonth),
    patientGrowthPct: growthPercent(patients.newThisMonth, patients.newLastMonth),
    genders: patients.genders,
  };
}

export async function getSummary(_req: Request, res: Response) {
  res.json({ success: true, data: await cache.get('summary', buildSummary) });
}

export async function getPatientsPerDoctor(req: Request, res: Response) {
  const { limit } = validated<{ limit: number }>(req, 'query');
  const data = await cache.get(`per-doctor:${limit}`, () => patientService.perDoctor(limit));
  res.json({ success: true, data });
}

/** Doctor and patient registrations merged onto one zero-filled time axis. */
export async function getTrends(req: Request, res: Response) {
  const { range } = validated<{ range: TrendRange }>(req, 'query');
  const data = await cache.get(`trends:${range}`, async () => {
    const [doctors, patients] = await Promise.all([doctorService.trends(range), patientService.trends(range)]);
    const doctorsByBucket = new Map(doctors.series.map((p) => [p.bucket, p.count]));
    return {
      range,
      unit: patients.unit,
      series: patients.series.map((p) => ({
        date: p.bucket,
        patients: p.count,
        doctors: doctorsByBucket.get(p.bucket) ?? 0,
      })),
    };
  });
  res.json({ success: true, data });
}

export async function getConditions(req: Request, res: Response) {
  const { limit } = validated<{ limit: number }>(req, 'query');
  const data = await cache.get(`conditions:${limit}`, () => patientService.conditions(limit));
  res.json({ success: true, data });
}

export async function getSpecializations(_req: Request, res: Response) {
  const data = await cache.get('specializations', () => doctorService.specializations());
  res.json({ success: true, data });
}

/** Not cached: the activity table should reflect a patient added a moment ago. */
export async function getRecentPatients(req: Request, res: Response) {
  const { limit } = validated<{ limit: number }>(req, 'query');
  res.json({ success: true, data: await patientService.recent(limit) });
}
