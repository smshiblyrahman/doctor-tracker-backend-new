import type { Request, Response } from 'express';
import { fillBuckets, monthBoundaries, resolveRange, validated, type TrendRange } from '@doctor-tracker/common';
import { Doctor } from '../models/Doctor';

/** Internal: headline doctor counts for the dashboard. */
export async function doctorSummary(_req: Request, res: Response) {
  const { startOfThisMonth, startOfLastMonth } = monthBoundaries();
  const [total, newThisMonth, newLastMonth] = await Promise.all([
    Doctor.estimatedDocumentCount(),
    Doctor.countDocuments({ createdAt: { $gte: startOfThisMonth } }),
    Doctor.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth } }),
  ]);
  res.json({ success: true, data: { total, newThisMonth, newLastMonth } });
}

/** Internal: doctors registered per day/month, zero-filled. Uses the createdAt index. */
export async function doctorTrends(req: Request, res: Response) {
  const { range } = validated<{ range: TrendRange }>(req, 'query');
  const resolved = resolveRange(range);
  const rows = await Doctor.aggregate<{ _id: string; count: number }>([
    { $match: { createdAt: { $gte: resolved.from } } },
    { $group: { _id: { $dateToString: { format: resolved.format, date: '$createdAt' } }, count: { $sum: 1 } } },
  ]);
  res.json({ success: true, data: { range, unit: resolved.unit, series: fillBuckets(resolved.buckets, rows) } });
}

/** Internal: doctors per specialization. */
export async function specializationBreakdown(_req: Request, res: Response) {
  const rows = await Doctor.aggregate<{ _id: string; count: number }>([
    { $group: { _id: '$specialization', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  res.json({ success: true, data: rows.map((r) => ({ specialization: r._id, count: r.count })) });
}
