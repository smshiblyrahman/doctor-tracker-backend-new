import { Schema, model, type HydratedDocument } from 'mongoose';
import { buildSearchTokens } from '@doctor-tracker/common';

export interface IDoctor {
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  /** Edge n-gram prefixes of the searchable fields; never returned to clients. */
  searchTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type DoctorDocument = HydratedDocument<IDoctor>;

export const SEARCHABLE_FIELDS = ['name', 'specialization', 'hospital', 'email', 'phone'] as const;

/**
 * Patients are owned by patient-service and reference their doctor by id
 * (`Patient.doctor`, indexed). The doctor document deliberately does not keep an
 * array of patient ids: that array would be unbounded and would have to be kept
 * in sync across two databases.
 */
export const doctorSchema = new Schema<IDoctor>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    specialization: { type: String, required: true, trim: true, maxlength: 80 },
    hospital: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    searchTokens: { type: [String], select: false, default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.searchTokens;
        return ret;
      },
    },
  },
);

doctorSchema.pre('save', function updateSearchTokens() {
  if (this.isNew || SEARCHABLE_FIELDS.some((field) => this.isModified(field))) {
    this.searchTokens = buildSearchTokens(SEARCHABLE_FIELDS.map((field) => this[field]));
  }
});

// Default listing: newest first, also serves date-range filters.
doctorSchema.index({ createdAt: -1 });
// Specialization filter + newest-first sort in one index.
doctorSchema.index({ specialization: 1, createdAt: -1 });
doctorSchema.index({ hospital: 1, createdAt: -1 });
// Prefix search (multikey).
doctorSchema.index({ searchTokens: 1 });
doctorSchema.index({ name: 1 });

export const Doctor = model<IDoctor>('Doctor', doctorSchema);
