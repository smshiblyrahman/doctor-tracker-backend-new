import type { Request, Response } from 'express';
import { fillBuckets, monthBoundaries, resolveRange, validated, type TrendRange } from '@doctor-tracker/common';
import { Patient } from '../models/Patient';

/** Internal: totals, month-over-month growth and gender split in one round of parallel queries. */
export async function patientSummary(_req: Request, res: Response) {
  const { startOfThisMonth, startOfLastMonth } = monthBoundaries();
  const [total, newThisMonth, newLastMonth, genderRows, ageRows] = await Promise.all([
    Patient.estimatedDocumentCount(),
    Patient.countDocuments({ createdAt: { $gte: startOfThisMonth } }),
    Patient.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth } }),
    Patient.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$gender', count: { $sum: 1 } } }]),
    Patient.aggregate<{ _id: null; avgAge: number }>([{ $group: { _id: null, avgAge: { $avg: '$age' } } }]),
  ]);

  res.json({
    success: true,
    data: {
      total,
      newThisMonth,
      newLastMonth,
      averageAge: ageRows[0]?.avgAge ? Math.round(ageRows[0].avgAge * 10) / 10 : 0,
      genders: genderRows.map((g) => ({ gender: g._id, count: g.count })).sort((a, b) => b.count - a.count),
    },
  });
}

/** Internal: patients per doctor, top N. Grouping on `doctor` is served by the {doctor, createdAt} index. */
export async function patientsPerDoctor(req: Request, res: Response) {
  const { limit } = validated<{ limit: number }>(req, 'query');
  const [rows, doctorsWithPatients] = await Promise.all([
    Patient.aggregate<{ _id: unknown; doctorName: string; count: number }>([
      { $group: { _id: '$doctor', doctorName: { $first: '$doctorName' }, count: { $sum: 1 } } },
      { $sort: { count: -1, doctorName: 1 } },
      { $limit: limit },
    ]),
    Patient.distinct('doctor').then((ids) => ids.length),
  ]);
  res.json({
    success: true,
    data: {
      doctorsWithPatients,
      items: rows.map((r) => ({ doctorId: String(r._id), doctorName: r.doctorName, count: r.count })),
    },
  });
}

/** Internal: patients registered per day/month, zero-filled. */
export async function patientTrends(req: Request, res: Response) {
  const { range } = validated<{ range: TrendRange }>(req, 'query');
  const resolved = resolveRange(range);
  const rows = await Patient.aggregate<{ _id: string; count: number }>([
    { $match: { createdAt: { $gte: resolved.from } } },
    { $group: { _id: { $dateToString: { format: resolved.format, date: '$createdAt' } }, count: { $sum: 1 } } },
  ]);
  res.json({ success: true, data: { range, unit: resolved.unit, series: fillBuckets(resolved.buckets, rows) } });
}

/** Internal: most common conditions, with the long tail rolled up into "Other". */
export async function conditionBreakdown(req: Request, res: Response) {
  const { limit } = validated<{ limit: number }>(req, 'query');
  const rows = await Patient.aggregate<{ _id: string; count: number }>([
    { $group: { _id: '$condition', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  const top = rows.slice(0, limit).map((r) => ({ condition: r._id, count: r.count }));
  const otherCount = rows.slice(limit).reduce((sum, r) => sum + r.count, 0);
  res.json({
    success: true,
    data: otherCount > 0 ? [...top, { condition: 'Other', count: otherCount }] : top,
  });
}

/** Internal: newest patients for the dashboard activity table. */
export async function recentPatients(req: Request, res: Response) {
  const { limit } = validated<{ limit: number }>(req, 'query');
  const patients = await Patient.find().sort({ createdAt: -1 }).limit(limit);
  res.json({ success: true, data: patients.map((p) => p.toJSON()) });
}
