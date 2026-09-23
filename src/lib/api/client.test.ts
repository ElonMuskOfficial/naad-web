import { describe, expect, it } from 'vitest';
import { ApiError, createAuthMiddleware, extractErrorCode, isApiError } from './client';

describe('ApiError and problem+json mapping', () => {
  it('extracts error code from URI type suffix', () => {
    expect(extractErrorCode('https://naad.dev/problems/not_found', 404)).toBe('not_found');
    expect(extractErrorCode('urn:naad:error:rate_limited', 429)).toBe('rate_limited');
    expect(extractErrorCode(undefined, 500)).toBe('500');
    expect(extractErrorCode('', 400)).toBe('400');
  });

  it('constructs typed ApiError from problem+json fields', () => {
    const err = new ApiError({
      type: 'https://naad.dev/problems/not_found',
      title: 'Not Found',
      status: 404,
      detail: 'Track trk_123 does not exist',
      requestId: 'req_abc',
      errors: [{ path: 'id', message: 'invalid ID' }],
    });

    expect(err).toBeInstanceOf(Error);
    expect(isApiError(err)).toBe(true);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(404);
    expect(err.code).toBe('not_found');
    expect(err.detail).toBe('Track trk_123 does not exist');
    expect(err.message).toBe('Track trk_123 does not exist');
    expect(err.requestId).toBe('req_abc');
    expect(err.errors).toEqual([{ path: 'id', message: 'invalid ID' }]);
  });
});

import type { Middleware } from 'openapi-fetch';

type OnRequestParams = Parameters<NonNullable<Middleware['onRequest']>>[0];
const mockOptions = {} as unknown as OnRequestParams['options'];
const mockParams = {} as unknown as OnRequestParams['params'];

describe('createAuthMiddleware', () => {
  it('adds Authorization: Bearer when an API key is present', async () => {
    const middleware = createAuthMiddleware(() => 'secret-test-key');
    const request = new Request('http://localhost:5173/v1/library/tracks');

    const result = await middleware.onRequest!({
      id: 'req_1',
      request,
      options: mockOptions,
      schemaPath: '/v1/library/tracks',
      params: mockParams,
    });

    expect((result as Request).headers.get('authorization')).toBe('Bearer secret-test-key');
  });

  it('does not add Authorization header when no API key is stored', async () => {
    const middleware = createAuthMiddleware(() => null);
    const request = new Request('http://localhost:5173/v1/library/tracks');

    const result = await middleware.onRequest!({
      id: 'req_2',
      request,
      options: mockOptions,
      schemaPath: '/v1/library/tracks',
      params: mockParams,
    });

    expect((result as Request).headers.has('authorization')).toBe(false);
  });

  it('does not overwrite existing Authorization header', async () => {
    const middleware = createAuthMiddleware(() => 'new-key');
    const request = new Request('http://localhost:5173/v1/library/tracks', {
      headers: { authorization: 'Bearer existing-key' },
    });

    const result = await middleware.onRequest!({
      id: 'req_3',
      request,
      options: mockOptions,
      schemaPath: '/v1/library/tracks',
      params: mockParams,
    });

    expect((result as Request).headers.get('authorization')).toBe('Bearer existing-key');
  });

  it('throws ApiError when response is not ok', async () => {
    const middleware = createAuthMiddleware(() => null);
    const problemBody = {
      type: 'https://naad.dev/problems/not_found',
      status: 404,
      detail: 'Album not found',
      requestId: 'req_999',
    };

    const response = new Response(JSON.stringify(problemBody), {
      status: 404,
      headers: { 'content-type': 'application/problem+json' },
    });

    await expect(
      middleware.onResponse!({
        id: 'req_4',
        request: new Request('http://localhost:5173/v1/albums/1'),
        response,
        options: mockOptions,
        schemaPath: '/v1/albums/{id}',
        params: mockParams,
      }),
    ).rejects.toThrow('Album not found');
  });
});
