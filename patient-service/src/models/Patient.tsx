import { Schema, Types, model, type HydratedDocument } from 'mongoose';
import { buildSearchTokens } from '@doctor-tracker/common';

export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

export interface IPatient {
  name: string;
  age: number;
  gender: Gender;
  condition: string;
  phone: string;
  /** Owning doctor (lives in doctor-service's database). */
  doctor: Types.ObjectId;
  /** Denormalized for listing without a cross-service join; synced on doctor rename. */
  doctorName: string;
  searchTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type PatientDocument = HydratedDocument<IPatient>;

export const SEARCHABLE_FIELDS = ['name', 'condition', 'phone'] as const;

export const patientSchema = new Schema<IPatient>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    age: { type: Number, required: true, min: 0, max: 130 },
    gender: { type: String, required: true, enum: GENDERS },
    condition: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    doctor: { type: Schema.Types.ObjectId, required: true },
    doctorName: { type: String, required: true, trim: true, maxlength: 100 },
    searchTokens: { type: [String], select: false, default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = String(ret._id);
        ret.doctor = String(ret.doctor);
        delete ret._id;
        delete ret.__v;
        delete ret.searchTokens;
        return ret;
      },
    },
  },
);

patientSchema.pre('save', function updateSearchTokens() {
  if (this.isNew || SEARCHABLE_FIELDS.some((field) => this.isModified(field))) {
    this.searchTokens = buildSearchTokens(SEARCHABLE_FIELDS.map((field) => this[field]));
  }
});

// "Patients of doctor X, newest first, paginated" is served straight from this index;
// it also covers the per-doctor $group and per-doctor counts.
patientSchema.index({ doctor: 1, createdAt: -1 });
patientSchema.index({ createdAt: -1 });
patientSchema.index({ condition: 1, createdAt: -1 });
patientSchema.index({ gender: 1, createdAt: -1 });
patientSchema.index({ searchTokens: 1 });
patientSchema.index({ name: 1 });

export const Patient = model<IPatient>('Patient', patientSchema);
