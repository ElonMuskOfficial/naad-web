/**
 * Compatibility between the `naad` engine and what the app was built to consume.
 *
 * `naad` is a small JioSaavn proxy: it sends fewer fields than the older engine this app was written for, has
 * one playback endpoint (`/audio`) instead of `/sources`, reports errors in Fastify's format, and returns a
 * playlist as `{ …, tracks }`. Everything that differs is adapted here, in one place, so components and query
 * keys stay as they are. The functions are pure; `client.ts` wires them into the openapi-fetch middleware.
 */

export interface Problem {
  type?: string | undefined;
  title?: string | undefined;
  status: number;
  detail?: string | undefined;
  [key: string]: unknown;
}

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

// ---- errors -----------------------------------------------------------------------------------------------

/** Fastify's `{ statusCode, error, message }` (or an RFC 7807 problem, or anything else) as a problem. */
export function toProblem(body: unknown, status: number): Problem {
  if (!isObject(body)) return { status };
  if (typeof body.statusCode === 'number' && typeof body.message === 'string' && body.detail === undefined) {
    return {
      status: body.statusCode,
      title: typeof body.error === 'string' ? body.error : undefined,
      detail: body.message,
      type: typeof body.code === 'string' ? body.code : undefined,
    };
  }
  return { ...body, status: typeof body.status === 'number' ? body.status : status };
}

// ---- playback ---------------------------------------------------------------------------------------------

/**
 * `/v1/tracks/{id}/sources?refresh=` as the equivalent `/audio` request. There are no quality tiers: `max` is the
 * best file JioSaavn has for the song (320 kbps for most), so that is always what is asked for.
 */
export function rewriteSourcesUrl(url: URL): URL {
  const out = new URL(url);
  out.pathname = out.pathname.replace(/\/sources$/, '/audio');
  out.searchParams.set('quality', 'max');
  if (url.searchParams.get('refresh') !== 'true') out.searchParams.delete('refresh');
  return out;
}

export interface NaadAudio {
  url: string;
  bitrateKbps: number;
  codec: string;
  mimeType: string;
  durationMs?: number | null;
}

/** The static CDN link stays valid for days; the app refreshes a link that is about to expire. */
const AUDIO_TTL_MS = 30 * 24 * 3600 * 1000;

/** An `/audio` answer as the `/sources` answer the player engine consumes. */
export function audioToSources(trackId: string, audio: NaadAudio, now = Date.now()) {
  const verifiedAt = new Date(now).toISOString();
  return {
    trackId,
    selected: {
      id: `jiosaavn:${trackId}:${audio.bitrateKbps}`,
      provider: 'jiosaavn',
      tier: audio.bitrateKbps >= 320 ? ('high' as const) : ('standard' as const),
      codec: audio.codec,
      container: 'mp4',
      mimeType: audio.mimeType,
      bitDepth: null,
      sampleRate: null,
      bitrateKbps: audio.bitrateKbps,
      durationMs: audio.durationMs ?? null,
      delivery: 'direct',
      matchScore: 1,
      normalization: null,
      verifiedAt,
    },
    alternatives: [] as never[],
    play: {
      url: audio.url,
      expiresAt: new Date(now + AUDIO_TTL_MS).toISOString(),
      mimeType: audio.mimeType,
      normalization: null,
    },
  };
}

// ---- shapes -----------------------------------------------------------------------------------------------

const looksLikeTrack = (o: Json) =>
  typeof o.title === 'string' && Array.isArray(o.artists) && 'durationMs' in o && 'images' in o;
const looksLikeAlbum = (o: Json) => typeof o.title === 'string' && 'albumType' in o;
const looksLikePlaylist = (o: Json) =>
  typeof o.title === 'string' &&
  'trackCount' in o &&
  'images' in o &&
  !('artists' in o) &&
  !('albumType' in o);

/** Fields of the old engine's model that naad does not send, filled with the "unknown" value (never overwritten). */
export function fillDefaults<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) fillDefaults(item);
    return value;
  }
  if (!isObject(value)) return value;
  const o = value as Json;
  if (looksLikeTrack(o)) {
    o.versionTags ??= [];
    o.isrc ??= null;
    o.discNumber ??= null;
    o.quality ??= null;
  } else if (looksLikeAlbum(o)) {
    o.upc ??= null;
  } else if (looksLikePlaylist(o)) {
    o.origin ??= 'external';
    o.inLibrary ??= false;
  }
  for (const child of Object.values(o)) fillDefaults(child);
  return value;
}

const EPOCH = new Date(0).toISOString();

/** naad's `{ …, tracks, entries? }` as the page the playlist screen reads: `{ …, items: { items, next } }`. */
export function withPlaylistItems(playlist: Json): Json {
  const tracks = Array.isArray(playlist.tracks) ? (playlist.tracks as Json[]) : [];
  const entries = Array.isArray(playlist.entries) ? (playlist.entries as Json[]) : [];
  const items = tracks.map((track, i) => ({
    itemId: (entries[i]?.itemId as string | undefined) ?? `${String(playlist.id)}:${i}`,
    addedAt: (entries[i]?.addedAt as string | undefined) ?? EPOCH,
    track,
  }));
  return {
    ...playlist,
    origin: playlist.origin ?? 'external',
    inLibrary: playlist.inLibrary ?? false,
    items: { items, next: null },
  };
}

/** Adapts one successful JSON response, by the schema path the app asked for. */
export function adaptResponse(schemaPath: string | undefined, json: unknown, requestUrl: string): unknown {
  let out = json;
  if (schemaPath === '/v1/tracks/{id}/sources' && isObject(json)) {
    const trackId = /\/v1\/tracks\/([^/?]+)\//.exec(requestUrl)?.[1] ?? '';
    out = audioToSources(decodeURIComponent(trackId), json as unknown as NaadAudio);
  } else if (schemaPath === '/v1/playlists/{id}' && isObject(json)) {
    out = withPlaylistItems(json);
  }
  return fillDefaults(out);
}
