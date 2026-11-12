import { createServiceClient, type AuthContext } from '@doctor-tracker/common';
import { env } from '../config/env';

const client = createServiceClient({
  target: 'Patient service',
  baseUrl: env.PATIENT_SERVICE_URL,
  caller: 'doctor-service',
  secret: env.INTERNAL_JWT_SECRET,
});

interface Envelope<T> {
  success: boolean;
  data: T;
}

/** Thin, typed wrapper over patient-service's REST + internal endpoints. */
export const patientService = {
  async countsByDoctor(doctorIds: string[]): Promise<Record<string, number>> {
    if (doctorIds.length === 0) return {};
    const res = await client.post<Envelope<Record<string, number>>>('/internal/patients/counts', {
      body: { doctorIds },
    });
    return res.data;
  },

  listForDoctor(doctorId: string, query: Record<string, any>, actor?: AuthContext) {
    return client.get<unknown>('/api/v1/patients', { query: { ...query, doctor: doctorId }, actor });
  },

  /** Internal mutations run as doctor-service: only it may create/remove patients under a doctor. */
  createForDoctor(doctor: { id: string; name: string }, patient: Record<string, unknown>) {
    return client.post<unknown>('/internal/patients', {
      body: { ...patient, doctor: doctor.id, doctorName: doctor.name },
    });
  },

  removeFromDoctor(doctorId: string, patientId: string) {
    return client.delete<unknown>(`/internal/patients/${patientId}`, { query: { doctor: doctorId } });
  },

  renameDoctor(doctorId: string, doctorName: string) {
    return client.patch<unknown>(`/internal/patients/by-doctor/${doctorId}`, { body: { doctorName } });
  },

  deleteAllForDoctor(doctorId: string) {
    return client.delete<Envelope<{ deletedCount: number }>>(`/internal/patients/by-doctor/${doctorId}`);
  },
};
