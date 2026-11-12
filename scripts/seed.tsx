/**
 * Seeds realistic demo data straight into the doctor and patient databases with
 * registration dates spread over the last 12 months (so the dashboard has trends).
 * Writes go through the raw driver so `createdAt` can be back-dated; search tokens
 * are computed with the same helper the services use.
 *
 *   npm run seed                      # 40 doctors, ~800 patients (replaces existing)
 *   npm run seed -- --doctors 100     # custom size
 */
import { config } from 'dotenv';
import path from 'node:path';
import mongoose, { Types } from 'mongoose';
import { buildSearchTokens } from '@doctor-tracker/common';
import { doctorSchema, SEARCHABLE_FIELDS as DOCTOR_FIELDS } from '../doctor-service/src/models/Doctor';
import { patientSchema, SEARCHABLE_FIELDS as PATIENT_FIELDS } from '../patient-service/src/models/Patient';

const doctorEnv = config({ path: path.resolve(__dirname, '../doctor-service/.env') }).parsed ?? {};
const patientEnv = config({ path: path.resolve(__dirname, '../patient-service/.env') }).parsed ?? {};
const DOCTORS_URI = process.env.DOCTORS_MONGO_URI ?? doctorEnv.MONGO_URI ?? 'mongodb://localhost:27017/doctor_tracker_doctors';
const PATIENTS_URI = process.env.PATIENTS_MONGO_URI ?? patientEnv.MONGO_URI ?? 'mongodb://localhost:27017/doctor_tracker_patients';

const argIndex = process.argv.indexOf('--doctors');
const DOCTOR_COUNT = argIndex > -1 ? Number(process.argv[argIndex + 1]) : 40;

// Deterministic PRNG so every seed produces the same dataset.
let state = 20241111;
function random() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
const between = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;

const FIRST = ['Sarah', 'James', 'Amara', 'Liam', 'Priya', 'Noah', 'Elena', 'Mateo', 'Aisha', 'Lucas', 'Hana', 'Ethan', 'Zara', 'Omar', 'Chloe', 'Daniel', 'Mei', 'Arjun', 'Grace', 'Kenji', 'Sofia', 'Ibrahim', 'Leah', 'Ravi', 'Nora', 'Samuel', 'Fatima', 'Owen', 'Yuki', 'Isaac', 'Maya', 'Tariq', 'Ava', 'Felix', 'Layla', 'Hugo', 'Nadia', 'Caleb', 'Ines', 'Jonah'];
const LAST = ['Chen', 'Walker', 'Okafor', 'Patel', 'Rahman', 'Garcia', 'Kim', 'Novak', 'Haddad', 'Silva', 'Tanaka', 'Murphy', 'Ahmed', 'Rossi', 'Johansson', 'Nguyen', 'Kowalski', 'Mensah', 'Fischer', 'Ali', 'Moreau', 'Hughes', 'Sato', 'Costa', 'Bennett', 'Iyer', 'Lopez', 'Reyes', 'Brooks', 'Karimi'];
const SPECIALIZATIONS = ['Cardiology', 'Dermatology', 'Endocrinology', 'Family Medicine', 'Gastroenterology', 'Neurology', 'Oncology', 'Orthopedics', 'Pediatrics', 'Psychiatry', 'Pulmonology', 'Rheumatology'];
const HOSPITALS = ["St. Mary's Medical Center", 'Riverside General Hospital', 'Northgate Clinic', 'Lakeview Health', 'Mercy University Hospital', 'Harbor Point Medical'];
const CONDITIONS: Record<string, string[]> = {
  Cardiology: ['Hypertension', 'Arrhythmia', 'Coronary Artery Disease', 'Heart Failure'],
  Dermatology: ['Eczema', 'Psoriasis', 'Acne', 'Melanoma Screening'],
  Endocrinology: ['Type 2 Diabetes', 'Hypothyroidism', 'Type 1 Diabetes', 'Osteoporosis'],
  'Family Medicine': ['Hypertension', 'Seasonal Allergies', 'Type 2 Diabetes', 'Annual Checkup'],
  Gastroenterology: ['IBS', 'GERD', "Crohn's Disease", 'Celiac Disease'],
  Neurology: ['Migraine', 'Epilepsy', "Parkinson's Disease", 'Multiple Sclerosis'],
  Oncology: ['Breast Cancer', 'Lung Cancer', 'Lymphoma', 'Prostate Cancer'],
  Orthopedics: ['Osteoarthritis', 'ACL Tear', 'Lower Back Pain', 'Fracture Recovery'],
  Pediatrics: ['Asthma', 'Otitis Media', 'ADHD', 'Annual Checkup'],
  Psychiatry: ['Anxiety Disorder', 'Depression', 'Bipolar Disorder', 'ADHD'],
  Pulmonology: ['Asthma', 'COPD', 'Sleep Apnea', 'Pneumonia'],
  Rheumatology: ['Rheumatoid Arthritis', 'Lupus', 'Gout', 'Osteoarthritis'],
};

const phone = () => `+1 555 ${between(200, 989)} ${String(between(0, 9999)).padStart(4, '0')}`;

/** Random date between `from` and now, skewed towards recent dates (growing practice). */
function recentDate(from: Date, skew = 1.6): Date {
  const span = Date.now() - from.getTime();
  return new Date(from.getTime() + span * (1 - Math.pow(random(), skew)));
}

async function main() {
  const doctorsConn = await mongoose.createConnection(DOCTORS_URI).asPromise();
  const patientsConn = await mongoose.createConnection(PATIENTS_URI).asPromise();
  const Doctor = doctorsConn.model('Doctor', doctorSchema);
  const Patient = patientsConn.model('Patient', patientSchema);

  console.log(`[seed] Clearing existing doctors and patients...`);
  await Promise.all([Doctor.deleteMany({}), Patient.deleteMany({})]);
  await Promise.all([Doctor.syncIndexes(), Patient.syncIndexes()]);

  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const usedEmails = new Set<string>();
  const doctors = Array.from({ length: DOCTOR_COUNT }, (_, i) => {
    const first = FIRST[i % FIRST.length];
    const last = pick(LAST);
    const hospital = pick(HOSPITALS);
    let email = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
    while (usedEmails.has(email)) email += between(1, 9);
    usedEmails.add(email);
    const createdAt = recentDate(yearAgo, 1.2);
    const doc = {
      _id: new Types.ObjectId(),
      name: `Dr. ${first} ${last}`,
      specialization: SPECIALIZATIONS[i % SPECIALIZATIONS.length],
      hospital,
      phone: phone(),
      email: `${email}@${hospital.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12)}.org`,
      createdAt,
      updatedAt: createdAt,
    };
    return { ...doc, searchTokens: buildSearchTokens(DOCTOR_FIELDS.map((f) => doc[f])), __v: 0 };
  });

  const patients = doctors.flatMap((doctor) => {
    // Uneven workloads make the "patients per doctor" chart meaningful.
    const count = Math.round(between(4, 36) * (0.6 + random()));
    return Array.from({ length: count }, () => {
      const createdAt = recentDate(doctor.createdAt);
      const doc = {
        _id: new Types.ObjectId(),
        name: `${pick(FIRST)} ${pick(LAST)}`,
        age: doctor.specialization === 'Pediatrics' ? between(1, 17) : between(18, 89),
        gender: random() < 0.48 ? 'female' : random() < 0.95 ? 'male' : 'other',
        condition: pick(CONDITIONS[doctor.specialization]),
        phone: phone(),
        doctor: doctor._id,
        doctorName: doctor.name,
        createdAt,
        updatedAt: createdAt,
      };
      return { ...doc, searchTokens: buildSearchTokens(PATIENT_FIELDS.map((f) => doc[f])), __v: 0 };
    });
  });

  await Doctor.collection.insertMany(doctors);
  await Patient.collection.insertMany(patients);
  console.log(`[seed] Inserted ${doctors.length} doctors and ${patients.length} patients.`);

  await Promise.all([doctorsConn.close(), patientsConn.close()]);
}

main().catch((err) => {
  console.error('[seed] failed:', err.message);
  console.error('Is MongoDB running? Start it with `npm run mongo` (or `npm run dev`).');
  process.exit(1);
});
