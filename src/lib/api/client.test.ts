import { describe, expect, it } from 'vitest';
import { ApiError, createAuthMiddleware, isApiError } from './client';

describe('ApiError', () => {
  it('constructs a readable ApiError from naad-shaped fields', () => {
    const err = new ApiError({ status: 404, title: 'Not Found', detail: 'Track trk_123 does not exist' });

    expect(err).toBeInstanceOf(Error);
    expect(isApiError(err)).toBe(true);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(404);
    expect(err.message).toBe('Track trk_123 does not exist');
    expect(err.title).toBe('Not Found');
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

  it('does not overwrite an existing Authorization header', async () => {
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

  it("turns naad's Fastify error body into a readable ApiError", async () => {
    const middleware = createAuthMiddleware(() => null);
    const response = new Response(
      JSON.stringify({ statusCode: 404, error: 'Not Found', message: 'Playlist not found' }),
      { status: 404, headers: { 'content-type': 'application/json' } },
    );

    let caught: unknown;
    try {
      await middleware.onResponse!({
        id: 'req_4',
        request: new Request('http://localhost:5173/v1/playlists/x'),
        response,
        options: mockOptions,
        schemaPath: '/v1/playlists/{id}',
        params: mockParams,
      });
    } catch (e) {
      caught = e;
    }

    expect(isApiError(caught)).toBe(true);
    expect((caught as ApiError).status).toBe(404);
    expect((caught as ApiError).message).toBe('Playlist not found');
    expect((caught as ApiError).title).toBe('Not Found');
  });

  it('leaves an empty 200 (what naad answers to mutations) alone', async () => {
    const middleware = createAuthMiddleware(() => null);
    const response = new Response(null, { status: 200 });
    const out = await middleware.onResponse!({
      id: 'req_5',
      request: new Request('http://localhost:5173/v1/library/tracks'),
      response,
      options: mockOptions,
      schemaPath: '/v1/library/tracks',
      params: mockParams,
    });
    expect((out as Response).status).toBe(200);
  });
});
