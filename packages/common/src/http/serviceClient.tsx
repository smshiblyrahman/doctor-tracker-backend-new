import { AppError } from '../errors';
import { INTERNAL_AUTH_HEADER, signInternalToken } from '../auth/internalToken';
import type { AuthContext } from '../types';

type QueryValue = string | number | boolean | Date | null | undefined;

export interface ServiceRequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Forward the end user's identity; otherwise the call is made as the calling service. */
  actor?: AuthContext;
}

export interface ServiceClientConfig {
  /** Human-readable name of the target, used in error messages. */
  target: string;
  baseUrl: string;
  /** Name of the calling service, used as the `sub` of service tokens. */
  caller: string;
  secret: string;
  timeoutMs?: number;
}

export interface ServiceClient {
  get<T>(path: string, options?: ServiceRequestOptions): Promise<T>;
  post<T>(path: string, options?: ServiceRequestOptions): Promise<T>;
  patch<T>(path: string, options?: ServiceRequestOptions): Promise<T>;
  delete<T>(path: string, options?: ServiceRequestOptions): Promise<T>;
}

/** Minimal typed REST client for internal service-to-service calls. */
export function createServiceClient(config: ServiceClientConfig): ServiceClient {
  const timeoutMs = config.timeoutMs ?? 8000;

  async function request<T>(method: string, path: string, options: ServiceRequestOptions = {}): Promise<T> {
    const url = new URL(path, config.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, value instanceof Date ? value.toISOString() : String(value));
    }

    const identity: AuthContext =
      options.actor?.kind === 'user' ? options.actor : { kind: 'service', sub: config.caller };

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          accept: 'application/json',
          ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
          [INTERNAL_AUTH_HEADER]: signInternalToken(identity, config.secret, 30),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw AppError.badGateway(`${config.target} is unavailable`);
    }

    const text = await response.text();
    let payload: any;
    try {
      payload = text ? JSON.parse(text) : undefined;
    } catch {
      throw AppError.badGateway(`${config.target} returned an invalid response`);
    }

    if (!response.ok) {
      const upstream = payload?.error;
      throw new AppError(
        response.status,
        upstream?.code ?? 'UPSTREAM_ERROR',
        upstream?.message ?? `${config.target} responded with status ${response.status}`,
        upstream?.details,
      );
    }
    return payload as T;
  }

  return {
    get: (path, options) => request('GET', path, options),
    post: (path, options) => request('POST', path, options),
    patch: (path, options) => request('PATCH', path, options),
    delete: (path, options) => request('DELETE', path, options),
  };
}
