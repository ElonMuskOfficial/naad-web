import { describe, expect, it } from 'vitest';
import { ApiError, createAuthMiddleware, extractErrorCode, isApiError } from './client';

// biome-ignore lint/suspicious/noExplicitAny: these tests inspect loosely typed JSON
type Loose = any;

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

describe('createAuthMiddleware with naad', () => {
  const ctx = (path: string, url: string) => ({
    id: 'req',
    request: new Request(url),
    options: mockOptions,
    schemaPath: path,
    params: mockParams,
  });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it("turns Fastify's error body into an ApiError with a readable message", async () => {
    const middleware = createAuthMiddleware(() => null);
    const response = json({ statusCode: 404, error: 'Not Found', message: 'Playlist not found' }, 404);
    const err: Loose = await (async () => {
      try {
        return await middleware.onResponse!({
          ...ctx('/v1/playlists/{id}', 'http://h/v1/playlists/x'),
          response,
        });
      } catch (e) {
        return e;
      }
    })();
    expect(isApiError(err)).toBe(true);
    expect(err.status).toBe(404);
    expect(err.message).toBe('Playlist not found');
    expect(err.title).toBe('Not Found');
  });

  it('sends the sources request to /audio for the best quality', async () => {
    const middleware = createAuthMiddleware(() => 'k');
    const result = (await middleware.onRequest!(
      ctx('/v1/tracks/{id}/sources', 'http://h/v1/tracks/abc123/sources?refresh=true'),
    )) as Request;
    const url = new URL(result.url);
    expect(url.pathname).toBe('/v1/tracks/abc123/audio');
    expect(url.searchParams.get('quality')).toBe('max');
    expect(url.searchParams.get('refresh')).toBe('true');
    expect(result.headers.get('authorization')).toBe('Bearer k');
  });

  it('answers the sources request in the shape the player consumes', async () => {
    const middleware = createAuthMiddleware(() => null);
    const response = json({
      url: 'https://c/x_320.mp4',
      bitrateKbps: 320,
      codec: 'aac',
      mimeType: 'audio/mp4',
      durationMs: 5,
    });
    const out = (await middleware.onResponse!({
      ...ctx('/v1/tracks/{id}/sources', 'http://h/v1/tracks/abc123/audio?quality=320'),
      response,
    })) as Response;
    const body = await out.json();
    expect(body.trackId).toBe('abc123');
    expect(body.selected.tier).toBe('high');
    expect(body.play.url).toBe('https://c/x_320.mp4');
  });

  it('fills the fields naad does not send on library responses', async () => {
    const middleware = createAuthMiddleware(() => null);
    const track = {
      id: 't1',
      title: 'T',
      artists: [],
      album: null,
      durationMs: 1,
      images: [],
      explicit: false,
      trackNumber: null,
      url: null,
    };
    const response = json({ items: [{ likedAt: '2026-09-26T10:00:00.000Z', track }], next: null });
    const out = (await middleware.onResponse!({
      ...ctx('/v1/library/tracks', 'http://h/v1/library/tracks'),
      response,
    })) as Response;
    const body = await out.json();
    expect(body.items[0].track).toMatchObject({ quality: null, isrc: null, versionTags: [] });
  });

  it('leaves an empty 200 (what naad answers to mutations) alone', async () => {
    const middleware = createAuthMiddleware(() => null);
    const response = new Response(null, { status: 200 });
    const out = await middleware.onResponse!({
      ...ctx('/v1/library/tracks', 'http://h/v1/library/tracks'),
      response,
    });
    expect((out as Response).status).toBe(200);
  });

  it('leaves a body that is not JSON alone', async () => {
    const middleware = createAuthMiddleware(() => null);
    const response = new Response('plain', { status: 200, headers: { 'content-type': 'text/plain' } });
    const out = (await middleware.onResponse!({ ...ctx('/v1/x', 'http://h/v1/x'), response })) as Response;
    expect(await out.text()).toBe('plain');
  });
});
