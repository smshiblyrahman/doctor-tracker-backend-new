import { createServiceClient, type BucketCount, type TrendRange } from '@doctor-tracker/common';
import { env } from '../config/env';

const client = createServiceClient({
  target: 'Doctor service',
  baseUrl: env.DOCTOR_SERVICE_URL,
  caller: 'dashboard-service',
  secret: env.INTERNAL_JWT_SECRET,
});

interface Envelope<T> {
  success: boolean;
  data: T;
}

export interface DoctorSummary {
  total: number;
  newThisMonth: number;
  newLastMonth: number;
}

export interface TrendSeries {
  range: TrendRange;
  unit: 'day' | 'month';
  series: BucketCount[];
}

export const doctorService = {
  summary: () => client.get<Envelope<DoctorSummary>>('/internal/doctors/stats/summary').then((r) => r.data),
  trends: (range: TrendRange) =>
    client.get<Envelope<TrendSeries>>('/internal/doctors/stats/trends', { query: { range } }).then((r) => r.data),
  specializations: () =>
    client
      .get<Envelope<Array<{ specialization: string; count: number }>>>('/internal/doctors/stats/specializations')
      .then((r) => r.data),
};
