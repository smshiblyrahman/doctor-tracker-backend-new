/** Identity forwarded between services, derived from a verified internal token. */
export interface AuthContext {
  kind: 'user' | 'service';
  /** User id for `user` callers, service name for `service` callers. */
  sub: string;
  email?: string;
  role?: string;
  name?: string;
}

export interface ValidatedRequestData {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
      /** Parsed + coerced output of the zod schemas run by `validate()`. */
      validated?: ValidatedRequestData;
    }
  }
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta;
}
