import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

export const API_KEY_STORAGE_KEY = 'naad:apiKey';
export const ENGINE_URL_STORAGE_KEY = 'naad:engineUrl';

/** Baked in at build time (Vite `VITE_*` vars), so a fresh browser with nothing in `localStorage` still
 *  works out of the box — this deployment always talks to the same engine, so there's no per-visitor secret
 *  to protect here; a per-browser override (below) still takes priority for anyone who wants to point this
 *  build at a different engine. */
const BUILD_ENGINE_URL = (import.meta.env.VITE_NAAD_ENGINE_URL as string | undefined)?.trim() || null;
const BUILD_API_KEY = (import.meta.env.VITE_NAAD_API_KEY as string | undefined)?.trim() || null;

export interface ProblemDetail {
  status: number;
  title?: string;
  detail?: string;
}

/** naad's plain Fastify error body is `{ statusCode, error, message }`; there is no other shape. */
function toProblem(body: unknown, status: number): ProblemDetail {
  if (typeof body !== 'object' || body === null) return { status };
  const b = body as Record<string, unknown>;
  return {
    status: typeof b.statusCode === 'number' ? b.statusCode : status,
    title: typeof b.error === 'string' ? b.error : undefined,
    detail: typeof b.message === 'string' ? b.message : undefined,
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly title?: string;

  constructor(problem: ProblemDetail) {
    super(problem.detail ?? problem.title ?? String(problem.status));
    this.name = 'ApiError';
    this.status = problem.status;
    this.title = problem.title;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function getStoredApiKey(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setStoredApiKey(key: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (key) {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }
}

export function getStoredEngineUrl(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(ENGINE_URL_STORAGE_KEY);
}

/** The engine URL actually in effect: a per-browser override if one was set, else the build's default. */
export function getEffectiveEngineUrl(): string | null {
  return getStoredEngineUrl() ?? BUILD_ENGINE_URL;
}

/** The API key actually in effect: a per-browser override if one was set, else the build's default. */
export function getEffectiveApiKey(): string | null {
  return getStoredApiKey() ?? BUILD_API_KEY;
}

export function setStoredEngineUrl(url: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (url) {
    localStorage.setItem(ENGINE_URL_STORAGE_KEY, url);
  } else {
    localStorage.removeItem(ENGINE_URL_STORAGE_KEY);
  }
}

/** Prefixes a `/v1/...` path with the effective Engine URL (or nothing, meaning same-origin). */
export function toEngineUrl(path: string): string {
  const base = (getEffectiveEngineUrl() ?? '').replace(/\/$/, '');
  return `${base}${path}`;
}

export function createAuthMiddleware(getApiKey: () => string | null = getEffectiveApiKey): Middleware {
  return {
    async onRequest({ request }) {
      const key = getApiKey();
      if (key && !request.headers.has('authorization')) {
        request.headers.set('authorization', `Bearer ${key}`);
      }
      return request;
    },
    async onResponse({ response }) {
      if (response.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('naad:unauthorized'));
        if (window.location.pathname !== '/settings') {
          window.location.href = '/settings';
        }
      }

      if (!response.ok) {
        let problem: ProblemDetail = { status: response.status };
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('json')) {
          try {
            problem = toProblem(await response.clone().json(), response.status);
          } catch {
            // response was not JSON, fall back to a bare status
          }
        }
        throw new ApiError(problem);
      }

      return response;
    },
  };
}

export function createApiClient(baseUrl?: string, getApiKey: () => string | null = getEffectiveApiKey) {
  const defaultUrl = typeof window !== 'undefined' ? '/' : 'http://127.0.0.1:8080';
  const url = baseUrl ?? getEffectiveEngineUrl() ?? defaultUrl;
  const client = createClient<paths>({ baseUrl: url });
  client.use(createAuthMiddleware(getApiKey));
  return client;
}

export const api = createApiClient();
