import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

export const API_KEY_STORAGE_KEY = 'naad:apiKey';
export const ENGINE_URL_STORAGE_KEY = 'naad:engineUrl';

export interface ProblemDetail {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  requestId?: string;
  errors?: Array<{ path: string; message: string }>;
}

export function extractErrorCode(type: string | undefined, status: number): string {
  if (!type) return String(status);
  const parts = type.split(/[/:]/);
  const last = parts[parts.length - 1];
  return last && last.length > 0 ? last : String(status);
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
  readonly requestId?: string;
  readonly errors?: Array<{ path: string; message: string }>;
  readonly title?: string;

  constructor(problem: ProblemDetail) {
    const code = extractErrorCode(problem.type, problem.status);
    super(problem.detail ?? problem.title ?? code);
    this.name = 'ApiError';
    this.status = problem.status;
    this.code = code;
    this.detail = problem.detail;
    this.requestId = problem.requestId;
    this.errors = problem.errors;
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

export function setStoredEngineUrl(url: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (url) {
    localStorage.setItem(ENGINE_URL_STORAGE_KEY, url);
  } else {
    localStorage.removeItem(ENGINE_URL_STORAGE_KEY);
  }
}

export function createAuthMiddleware(getApiKey: () => string | null = getStoredApiKey): Middleware {
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
            const json = await response.clone().json();
            if (json && typeof json === 'object') {
              problem = { ...json, status: json.status ?? response.status };
            }
          } catch {
            // response was not JSON, fallback to basic status
          }
        }
        throw new ApiError(problem);
      }
      return response;
    },
  };
}

export function createApiClient(baseUrl?: string, getApiKey: () => string | null = getStoredApiKey) {
  const defaultUrl = typeof window !== 'undefined' ? '/' : 'http://127.0.0.1:8080';
  const url = baseUrl ?? getStoredEngineUrl() ?? defaultUrl;
  const client = createClient<paths>({ baseUrl: url });
  client.use(createAuthMiddleware(getApiKey));
  return client;
}

export const api = createApiClient();
