import { z } from 'zod';
import type { PipelineStage } from 'mongoose';
import type { Paginated, PaginationMeta } from '../types';

export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(10),
});

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

interface AggregateModel {
  aggregate(pipeline: PipelineStage[]): { exec(): Promise<any[]> };
}

export interface PaginateOptions {
  match: Record<string, unknown>;
  sort: Record<string, 1 | -1>;
  page: number;
  limit: number;
  project?: Record<string, unknown>;
}

/**
 * One round trip for page + total: `$match → $sort → $facet{ items: [$skip, $limit], total: [$count] }`.
 * `$match` and `$sort` sit before `$facet` so MongoDB can serve them from an index.
 */
export async function paginate<T>(model: AggregateModel, options: PaginateOptions): Promise<Paginated<T>> {
  const { match, sort, page, limit, project } = options;
  const itemsPipeline: any[] = [{ $skip: (page - 1) * limit }, { $limit: limit }];
  if (project) itemsPipeline.push({ $project: project });

  const [result] = await model
    .aggregate([
      { $match: match },
      { $sort: sort },
      { $facet: { items: itemsPipeline, total: [{ $count: 'count' }] } },
    ] as PipelineStage[])
    .exec();

  const total: number = result?.total?.[0]?.count ?? 0;
  return { items: (result?.items ?? []) as T[], pagination: buildPaginationMeta(total, page, limit) };
}

/** Parses `field:direction` sort strings against a whitelist; `_id` is a stable tiebreaker. */
export function parseSort(value: string): Record<string, 1 | -1> {
  const [field, direction] = value.split(':');
  return { [field]: direction === 'asc' ? 1 : -1, _id: direction === 'asc' ? 1 : -1 };
}
