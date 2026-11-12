import { z } from 'zod';

export const TREND_RANGES = ['7d', '30d', '90d', '12m'] as const;
export type TrendRange = (typeof TREND_RANGES)[number];
export const trendRangeSchema = z.enum(TREND_RANGES).default('30d');

export interface ResolvedRange {
  range: TrendRange;
  from: Date;
  unit: 'day' | 'month';
  /** `$dateToString` format matching the bucket keys. */
  format: string;
  buckets: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** All bucket keys for a range, oldest first, so charts get a continuous axis. */
export function resolveRange(range: TrendRange, now: Date = new Date()): ResolvedRange {
  if (range === '12m') {
    const buckets: string[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      buckets.push(d.toISOString().slice(0, 7));
    }
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    return { range, from, unit: 'month', format: '%Y-%m', buckets };
  }

  const days = Number.parseInt(range, 10);
  const today = startOfUtcDay(now);
  const from = new Date(today.getTime() - (days - 1) * DAY_MS);
  const buckets: string[] = [];
  for (let i = 0; i < days; i += 1) buckets.push(new Date(from.getTime() + i * DAY_MS).toISOString().slice(0, 10));
  return { range, from, unit: 'day', format: '%Y-%m-%d', buckets };
}

export interface BucketCount {
  bucket: string;
  count: number;
}

/** Zero-fills grouped counts onto the full bucket axis. */
export function fillBuckets(buckets: string[], rows: Array<{ _id: string; count: number }>): BucketCount[] {
  const byKey = new Map(rows.map((r) => [r._id, r.count]));
  return buckets.map((bucket) => ({ bucket, count: byKey.get(bucket) ?? 0 }));
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');

/** `from`/`to` query params (inclusive, UTC days). */
export const dateRangeQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

/** `{ createdAt: { $gte, $lte } }` for an inclusive YYYY-MM-DD range, or `{}`. */
export function createdAtMatch(from?: string, to?: string): Record<string, unknown> {
  if (!from && !to) return {};
  const range: Record<string, Date> = {};
  if (from) range.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) range.$lte = new Date(`${to}T23:59:59.999Z`);
  return { createdAt: range };
}

/** Start of the current and previous UTC month, for "new this month" style stats. */
export function monthBoundaries(now: Date = new Date()) {
  const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { startOfThisMonth, startOfLastMonth };
}
