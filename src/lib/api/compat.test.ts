import { describe, expect, it } from 'vitest';
import {
  adaptResponse,
  audioToSources,
  fillDefaults,
  rewriteSourcesUrl,
  toProblem,
  withPlaylistItems,
} from './compat';

// biome-ignore lint/suspicious/noExplicitAny: these tests inspect loosely typed JSON
type Loose = any;

const track = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Track ${id}`,
  artists: [{ id: 'a1', name: 'Artist' }],
  album: null,
  durationMs: 200_000,
  explicit: false,
  trackNumber: null,
  images: [],
  url: null,
  ...extra,
});

describe('toProblem', () => {
  it("maps Fastify's error body onto the problem the app understands", () => {
    expect(toProblem({ statusCode: 404, error: 'Not Found', message: 'Playlist not found' }, 404)).toEqual({
      status: 404,
      title: 'Not Found',
      detail: 'Playlist not found',
      type: undefined,
    });
  });

  it('keeps the error code of validation failures as the problem type', () => {
    const p = toProblem(
      {
        statusCode: 400,
        code: 'FST_ERR_VALIDATION',
        error: 'Bad Request',
        message: 'body/title must NOT have fewer than 1 characters',
      },
      400,
    );
    expect(p.type).toBe('FST_ERR_VALIDATION');
    expect(p.detail).toContain('title');
  });

  it('passes an RFC 7807 problem through and defaults the status', () => {
    expect(toProblem({ type: 'urn:naad:error:rate_limited', detail: 'slow down' }, 429)).toEqual({
      type: 'urn:naad:error:rate_limited',
      detail: 'slow down',
      status: 429,
    });
  });

  it('survives a body that is not an object', () => {
    expect(toProblem('boom', 502)).toEqual({ status: 502 });
    expect(toProblem(null, 500)).toEqual({ status: 500 });
  });
});

// There are no quality tiers: JioSaavn's best file is always the one asked for (`max`).
describe('sources request', () => {
  it('becomes an audio request for the best quality, keeping refresh', () => {
    const url = rewriteSourcesUrl(new URL('http://localhost:5173/v1/tracks/abc123/sources?refresh=true'));
    expect(url.pathname).toBe('/v1/tracks/abc123/audio');
    expect(url.searchParams.get('quality')).toBe('max');
    expect(url.searchParams.get('refresh')).toBe('true');
  });

  it('asks for the best quality whatever an old caller put in the URL', () => {
    for (const quality of ['standard', 'high', 'lossless', 'hires', '96', 'nonsense']) {
      const url = rewriteSourcesUrl(
        new URL(`http://localhost:5173/v1/tracks/abc123/sources?quality=${quality}`),
      );
      expect(url.searchParams.get('quality')).toBe('max');
    }
  });

  it('drops refresh when it was not asked for', () => {
    const url = rewriteSourcesUrl(new URL('http://localhost:5173/v1/tracks/abc123/sources'));
    expect(url.searchParams.get('quality')).toBe('max');
    expect(url.searchParams.has('refresh')).toBe(false);
  });
});

describe('audioToSources', () => {
  const audio = {
    url: 'https://aac.saavncdn.com/x_320.mp4',
    bitrateKbps: 320,
    codec: 'aac',
    mimeType: 'audio/mp4',
    durationMs: 268_000,
  };
  const now = Date.UTC(2026, 8, 26);

  it('builds the source and play info the player engine consumes', () => {
    const s = audioToSources('trk1', audio, now);
    expect(s.trackId).toBe('trk1');
    expect(s.selected).toMatchObject({
      provider: 'jiosaavn',
      tier: 'high',
      codec: 'aac',
      mimeType: 'audio/mp4',
      bitDepth: null,
      sampleRate: null,
      bitrateKbps: 320,
      durationMs: 268_000,
      matchScore: 1,
      normalization: null,
    });
    expect(s.alternatives).toEqual([]);
    expect(s.play).toEqual({
      url: audio.url,
      expiresAt: new Date(now + 30 * 24 * 3600 * 1000).toISOString(),
      mimeType: 'audio/mp4',
      normalization: null,
    });
  });

  it('calls anything below 320 kbps standard', () => {
    expect(audioToSources('t', { ...audio, bitrateKbps: 160 }, now).selected.tier).toBe('standard');
    expect(audioToSources('t', { ...audio, bitrateKbps: 96 }, now).selected.tier).toBe('standard');
  });

  it('copes with a missing duration', () => {
    const s = audioToSources('t', { ...audio, durationMs: undefined as unknown as number }, now);
    expect(s.selected.durationMs).toBeNull();
  });
});

describe('fillDefaults', () => {
  it('gives tracks the fields naad does not send, wherever they are nested', () => {
    const out = fillDefaults({
      sections: [{ kind: 'tracks', items: [track('a')] }],
      topResult: { type: 'track', item: track('b') },
    }) as Loose;
    for (const t of [out.sections[0].items[0], out.topResult.item]) {
      expect(t).toMatchObject({ versionTags: [], isrc: null, discNumber: null, quality: null });
    }
  });

  it('never overwrites what naad did send', () => {
    const out = fillDefaults(
      track('a', { isrc: 'US123', versionTags: ['live'], quality: { tier: 'high' } }),
    ) as Loose;
    expect(out.isrc).toBe('US123');
    expect(out.versionTags).toEqual(['live']);
    expect(out.quality).toEqual({ tier: 'high' });
  });

  it('marks playlist summaries as external and not in the library, unless told otherwise', () => {
    const out = fillDefaults({
      items: [
        { id: 'p1', title: 'P', description: null, trackCount: 3, images: [] },
        {
          id: 'usr_1',
          title: 'Mine',
          description: null,
          trackCount: 1,
          images: [],
          origin: 'user',
          inLibrary: true,
        },
      ],
    }) as Loose;
    expect(out.items[0]).toMatchObject({ origin: 'external', inLibrary: false });
    expect(out.items[1]).toMatchObject({ origin: 'user', inLibrary: true });
  });

  it('adds upc to albums and does not mistake an album for a playlist', () => {
    const out = fillDefaults({
      id: 'al1',
      title: 'Album',
      albumType: 'album',
      trackCount: 9,
      artists: [],
      images: [],
    }) as Loose;
    expect(out.upc).toBeNull();
    expect('origin' in out).toBe(false);
  });

  it('is idempotent and leaves plain values alone', () => {
    const once = fillDefaults({ a: [track('a')], n: 1, s: 'x', z: null });
    expect(fillDefaults(structuredClone(once))).toEqual(once);
    expect(fillDefaults(5)).toBe(5);
    expect(fillDefaults(null)).toBeNull();
  });
});

describe('withPlaylistItems', () => {
  it('builds items from tracks and the entries of a user playlist', () => {
    const out = withPlaylistItems({
      id: 'usr_1',
      title: 'Mine',
      origin: 'user',
      tracks: [track('a'), track('b')],
      entries: [
        { itemId: 'i1', addedAt: '2026-09-26T10:00:00.000Z' },
        { itemId: 'i2', addedAt: '2026-09-26T10:01:00.000Z' },
      ],
    }) as Loose;
    expect(out.items.next).toBeNull();
    expect(out.items.items.map((i: Loose) => [i.itemId, i.track.id])).toEqual([
      ['i1', 'a'],
      ['i2', 'b'],
    ]);
  });

  it('invents stable item ids for an external playlist', () => {
    const out = withPlaylistItems({ id: 'p1', title: 'X', tracks: [track('a'), track('a')] }) as Loose;
    expect(out.items.items.map((i: Loose) => i.itemId)).toEqual(['p1:0', 'p1:1']);
    expect(out.origin).toBe('external');
    expect(out.inLibrary).toBe(false);
  });

  it('copes with a playlist without tracks', () => {
    const out = withPlaylistItems({ id: 'p1', title: 'X' }) as Loose;
    expect(out.items).toEqual({ items: [], next: null });
  });
});

describe('adaptResponse', () => {
  it('turns an audio answer into sources when the app asked for sources', () => {
    const out = adaptResponse(
      '/v1/tracks/{id}/sources',
      { url: 'https://c/x_96.mp4', bitrateKbps: 96, codec: 'aac', mimeType: 'audio/mp4', durationMs: 1 },
      'http://localhost:5173/v1/tracks/abc123/audio?quality=160',
    ) as Loose;
    expect(out.trackId).toBe('abc123');
    expect(out.play.url).toBe('https://c/x_96.mp4');
  });

  it('reshapes a playlist page and fills its tracks', () => {
    const out = adaptResponse(
      '/v1/playlists/{id}',
      { id: 'p1', title: 'X', tracks: [track('a')] },
      'http://h/v1/playlists/p1',
    ) as Loose;
    expect(out.items.items[0].track).toMatchObject({ id: 'a', quality: null });
  });

  it('leaves other endpoints to fillDefaults only', () => {
    const out = adaptResponse('/v1/library/tracks/contains', [true, false], 'http://h/x');
    expect(out).toEqual([true, false]);
  });

  it('returns undefined-safe results for a missing schema path', () => {
    expect(adaptResponse(undefined, { a: 1 }, 'http://h/x')).toEqual({ a: 1 });
  });
});
