import { createServiceClient, type TrendRange } from '@doctor-tracker/common';
import { env } from '../config/env';
import type { TrendSeries } from './doctorService.client';

const client = createServiceClient({
  target: 'Patient service',
  baseUrl: env.PATIENT_SERVICE_URL,
  caller: 'dashboard-service',
  secret: env.INTERNAL_JWT_SECRET,
});

interface Envelope<T> {
  success: boolean;
  data: T;
}

export interface PatientSummary {
  total: number;
  newThisMonth: number;
  newLastMonth: number;
  averageAge: number;
  genders: Array<{ gender: string; count: number }>;
}

export interface PerDoctorStats {
  doctorsWithPatients: number;
  items: Array<{ doctorId: string; doctorName: string; count: number }>;
}

export interface RecentPatient {
  id: string;
  name: string;
  age: number;
  gender: string;
  condition: string;
  doctor: string;
  doctorName: string;
  createdAt: string;
}

export const patientService = {
  summary: () => client.get<Envelope<PatientSummary>>('/internal/patients/stats/summary').then((r) => r.data),
  perDoctor: (limit: number) =>
    client.get<Envelope<PerDoctorStats>>('/internal/patients/stats/per-doctor', { query: { limit } }).then((r) => r.data),
  trends: (range: TrendRange) =>
    client.get<Envelope<TrendSeries>>('/internal/patients/stats/trends', { query: { range } }).then((r) => r.data),
  conditions: (limit: number) =>
    client
      .get<Envelope<Array<{ condition: string; count: number }>>>('/internal/patients/stats/conditions', {
        query: { limit },
      })
      .then((r) => r.data),
  recent: (limit: number) =>
    client.get<Envelope<RecentPatient[]>>('/internal/patients/stats/recent', { query: { limit } }).then((r) => r.data),
};
