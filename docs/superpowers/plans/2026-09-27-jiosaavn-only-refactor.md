# JioSaavn-only Frontend Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every type, code path, and UI surface in `naad-web` that exists only to model the old multi-provider `naad-v3` engine, replacing them with a small, accurate model of the real, single-provider `naad` (JioSaavn-only) engine, and delete the `compat.ts` adapter layer that currently bridges the gap.

**Architecture:** Replace the hand-kept `schema.d.ts` (a stale `naad-v3` OpenAPI snapshot) with a small hand-written type file matching naad's real JSON responses. Delete `compat.ts` (no longer needed once the types match reality). Rewire the player engine, scheduler, and quality UI to consume naad's flat `Audio` object (`{url, bitrateKbps, codec, mimeType, durationMs}`) directly instead of the old `Source`/`alternatives`/`tier`/`delivery`/`normalization` model. Simplify UI that displays fields naad never sends (ISRC, UPC, disc grouping, version tags, hi-res/lossless tiers). Bundle three previously-diagnosed correctness bugs into the files this refactor already opens.

**Tech Stack:** SvelteKit 2 (Svelte 5 runes), TypeScript strict, `openapi-fetch` + hand-written `paths`/`components` types, `@tanstack/svelte-query`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-27-jiosaavn-only-refactor-design.md`

## Global Constraints

- Every route and field in the new type file must be verified against `naad`'s actual source (`naad/lib/jiosaavn/*.js`, `naad/routes/v1/**`) — never assumed or copied from the old `naad-v3`-era `schema.d.ts`.
- No route naad doesn't have (`/v1/imports`, `/v1/resolve`, `/v1/stream/*`, `/v1/mixes`, `/v1/charts`, `/v1/new-releases`, `/v1/queue/*`, `/v1/tracks/{id}/play`) may appear in the new type file.
- No frontend behavior change beyond what's specified: crossfade, search, library CRUD, radio, and history batching stay as they are except for the one named bug fix in Task 4.
- No changes to `naad` (the backend) in this plan. The search-offset overflow bug (spec Section 5, item 3) is explicitly out of scope here.
- Every touched `*.test.ts` is updated in the same task as its source file. `npm run check`, `npm run lint`, and `npm run test` are only required to be fully clean at the end of Task 9 — earlier tasks will leave `npm run check` reporting errors in files a later task still owns; each task's own step 2 (or equivalent) names exactly which errors are expected and why.

## Review Focus

- **A track with no album** (`track.album === null`, e.g. a loose single or a JioSaavn top-result track): the new `Track` type must keep `album` nullable, and nothing added in this refactor should assume `track.album` is always present. Covered by Task 1's type definition and Task 7's fixtures (`trk_kesariya_lofi`-equivalent already has `album: null`).
- **A track that has never been played, so naad has no cached audio measurement for it**: the new `Audio`-based player state must not assume `currentAudio` is ever non-null before the first successful `/audio` call — covered by Task 3's engine tests (`currentAudio` starts `null`, `QualityBadge`/`SignalPathCard` callers guard on it being present).
- **An external (JioSaavn-owned) playlist, which has no `entries` and is never editable**: Task 1's `Playlist` type must keep `entries`/`origin`/`inLibrary` optional so a plain search-result or home-feed playlist (which naad never enriches with those fields) still type-checks, and nothing added here should assume every playlist is the user's own. Covered by Task 1's type comments and the existing (unmodified) `userPlaylists()` filter in `queries/index.ts`.
- **The player engine handling two tracks back-to-back with crossfade on**: Task 3 removes the `gainDb` parameter from `AudioGraph`/`math.ts`, and must not accidentally also remove or change the crossfade volume-ramp math, since that's explicitly a kept feature — covered by Task 3 keeping `startCrossfade` untouched except for dropping the now-removed `gainDb` lookups, verified by not deleting any crossfade-specific test.
- **A track whose `/audio` call fails entirely (network error, 404, or the retry-with-`refresh=true` also failing)**: Task 3's rewritten `handleAudioError` must still fall through to the existing "toast + skip to next" behavior — covered by keeping that fallback path unchanged and noting it explicitly in Task 3's steps.

---

## Task 1: Hand-written type model matching naad's real responses

**Files:**
- Modify: `src/lib/api/schema.d.ts` (full replacement)
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: nothing (this is the foundation task).
- Produces: `components['schemas']['Track' | 'Album' | 'Artist' | 'Playlist' | 'Audio' | 'Section' | 'Image' | 'ArtistRef']` and `paths[...]` entries for every real naad route. Re-exported from `src/lib/types.ts` as `Track`, `Album`, `Artist`, `Playlist`, `Audio`, `Problem`, `ArtistRef`, `Image`. Every later task imports these names.

This task alone will leave `npm run check` reporting errors in every file that still references the old `Source`/`quality`/`isrc`/`upc`/`discNumber`/`versionTags`/`liked`/`links` fields or the `/v1/tracks/{id}/sources` path — that's expected; Tasks 2–7 fix each of those files in turn. This task's own test is that the file is syntactically valid TypeScript and that `client.ts`'s existing `import type { paths } from './schema'` and `types.ts`'s `import type { components } from './api/schema'` still resolve.

- [ ] **Step 1: Replace `src/lib/api/schema.d.ts` in full**

Verified field-by-field against `naad/lib/jiosaavn/map.js` (`trackView`, `albumView`, `artistView`, `playlistView`), `naad/lib/jiosaavn/catalog.js` (`getTrack`, `getAlbum`, `getArtist`, `getPlaylist`, `search`), `naad/lib/jiosaavn/home.js` (`sectionsFromLaunchData`), `naad/lib/jiosaavn/discovery.js` (`radio`), and every route file under `naad/routes/v1/`.

```typescript
/**
 * Hand-written to match `naad`'s real JSON responses exactly. `naad` has no OpenAPI document to
 * generate this from (see naad-web/HANDOFF.md and naad/README.md) — every shape below was verified
 * directly against naad's source, not assumed or carried over from the old naad-v3-era file this
 * replaces. Routes naad does not have (imports, resolve, stream, mixes, charts, new-releases, queue,
 * /tracks/{id}/play) are intentionally absent, as is every multi-provider field naad never sends
 * (Source/tier/delivery/normalization/alternatives, Track.quality/isrc/versionTags/discNumber/liked/
 * links, Album.upc).
 */

export interface paths {
  "/v1/home": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { "application/json": { sections: components["schemas"]["Section"][] } };
        };
      };
    };
  };
  "/v1/search": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: {
        query: { q: string; types?: string; limit?: number; offset?: number };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": {
              topResult:
                | { type: "track"; item: components["schemas"]["Track"] }
                | { type: "album"; item: components["schemas"]["Album"] }
                | { type: "artist"; item: components["schemas"]["Artist"] }
                | null;
              tracks: components["schemas"]["Track"][];
              albums: components["schemas"]["Album"][];
              artists: components["schemas"]["Artist"][];
              playlists: components["schemas"]["Playlist"][];
              nextOffset: number | null;
            };
          };
        };
      };
    };
  };
  "/v1/tracks/{id}": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { "application/json": components["schemas"]["Track"] };
        };
      };
    };
  };
  "/v1/tracks/{id}/audio": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    get: {
      parameters: {
        query?: { quality?: "max" | "320" | "160" | "96"; refresh?: boolean };
        header?: never;
        path: { id: string };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { "application/json": components["schemas"]["Audio"] };
        };
      };
    };
  };
  "/v1/tracks/{id}/lyrics": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": {
              trackId: string;
              synced: { timeMs: number; text: string }[] | null;
              plain: string | null;
              source: string;
            };
          };
        };
      };
    };
  };
  "/v1/albums/{id}": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": components["schemas"]["Album"] & {
              tracks: components["schemas"]["Track"][];
            };
          };
        };
      };
    };
  };
  "/v1/artists/{id}": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": components["schemas"]["Artist"] & {
              topTracks: components["schemas"]["Track"][];
              albums: components["schemas"]["Album"][];
              singles: components["schemas"]["Album"][];
              related: components["schemas"]["Artist"][];
            };
          };
        };
      };
    };
  };
  "/v1/playlists/{id}": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    get: {
      parameters: {
        query?: { limit?: number };
        header?: never;
        path: { id: string };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { "application/json": components["schemas"]["Playlist"] };
        };
      };
    };
    patch: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody: {
        content: { "application/json": { title?: string; description?: string | null } };
      };
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
    delete: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/playlists": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    post: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody: {
        content: {
          "application/json": { title: string; description?: string | null; trackIds?: string[] };
        };
      };
      responses: {
        201: { headers: { [name: string]: unknown }; content: { "application/json": { id: string } } };
      };
    };
  };
  "/v1/playlists/{id}/items": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    post: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody: {
        content: { "application/json": { trackIds: string[]; position?: "start" | "end" } };
      };
      responses: {
        201: {
          headers: { [name: string]: unknown };
          content: { "application/json": { itemIds: string[] } };
        };
      };
    };
    delete: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody: { content: { "application/json": { itemIds: string[] } } };
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/playlists/{id}/items/{itemId}/move": {
    parameters: { query?: never; header?: never; path: { id: string; itemId: string }; cookie?: never };
    post: {
      parameters: { query?: never; header?: never; path: { id: string; itemId: string }; cookie?: never };
      requestBody: { content: { "application/json": { afterItemId: string | null } } };
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/library/tracks": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: {
        query?: { limit?: number; cursor?: string };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": {
              items: { likedAt: string; track: components["schemas"]["Track"] }[];
              next: string | null;
            };
          };
        };
      };
    };
    put: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody: { content: { "application/json": { trackIds: string[] } } };
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
    delete: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody: { content: { "application/json": { trackIds: string[] } } };
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/library/tracks/contains": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: { query: { ids: string }; header?: never; path?: never; cookie?: never };
      requestBody?: never;
      responses: {
        200: { headers: { [name: string]: unknown }; content: { "application/json": boolean[] } };
      };
    };
  };
  "/v1/library/albums": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: {
        query?: { limit?: number; cursor?: string };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": {
              items: { savedAt: string; album: components["schemas"]["Album"] }[];
              next: string | null;
            };
          };
        };
      };
    };
  };
  "/v1/library/albums/{id}": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    put: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
    delete: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/library/artists": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: {
        query?: { limit?: number; cursor?: string };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": {
              items: { followedAt: string; artist: components["schemas"]["Artist"] }[];
              next: string | null;
            };
          };
        };
      };
    };
  };
  "/v1/library/artists/{id}": {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    put: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
    delete: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody?: never;
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/library/playlists": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { "application/json": { items: components["schemas"]["Playlist"][] } };
        };
      };
    };
  };
  "/v1/history": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: {
        query?: { limit?: number; cursor?: string };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: {
            "application/json": {
              items: { playedAt: string; msPlayed: number; track: components["schemas"]["Track"] }[];
              next: string | null;
            };
          };
        };
      };
    };
    post: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody: {
        content: {
          "application/json": {
            listens: {
              trackId: string;
              startedAt: string;
              msPlayed: number;
              completed?: boolean;
              context?: { type: string; id: string } | null;
              sourceProvider?: string;
            }[];
          };
        };
      };
      responses: { 200: { headers: { [name: string]: unknown }; content?: never } };
    };
  };
  "/v1/radio": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: {
        query: { seed: string; limit?: number; exclude?: string };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { "application/json": { seed: string; tracks: components["schemas"]["Track"][] } };
        };
      };
    };
  };
  "/v1/player/prefetch": {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    post: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody: { content: { "application/json": { trackIds: string[] } } };
      responses: {
        202: {
          headers: { [name: string]: unknown };
          content: { "application/json": { accepted: number } };
        };
      };
    };
  };
}

export interface components {
  schemas: {
    Image: { url: string; width?: number; height?: number };
    ArtistRef: { id: string; name: string };
    /** The real, flat shape of `GET /v1/tracks/{id}/audio` — naad's only playback endpoint. */
    Audio: {
      url: string;
      bitrateKbps: number;
      codec: string;
      mimeType: string;
      durationMs: number | null;
    };
    Track: {
      id: string;
      title: string;
      artists: components["schemas"]["ArtistRef"][];
      album: { id: string; title: string; images: components["schemas"]["Image"][] } | null;
      durationMs: number | null;
      explicit: boolean;
      /** Always null from naad today; kept because `trackView` in map.js emits the field. */
      trackNumber: number | null;
      images: components["schemas"]["Image"][];
      /** JioSaavn's own `perma_url`. */
      url: string | null;
    };
    /** No `tracks` field here — only `GET /v1/albums/{id}` adds it (see the `paths` entry above). */
    Album: {
      id: string;
      title: string;
      albumType: "single" | "album";
      releaseDate: string | null;
      label: string | null;
      trackCount: number;
      explicit: boolean;
      artists: components["schemas"]["ArtistRef"][];
      images: components["schemas"]["Image"][];
    };
    Artist: {
      id: string;
      name: string;
      images: components["schemas"]["Image"][];
    };
    /**
     * `tracks`/`entries` are only present on the direct `GET /v1/playlists/{id}` response for the
     * user's own playlists; `origin`/`inLibrary` are only present on `GET /v1/library/playlists` and
     * on a JioSaavn playlist fetched by id. A playlist inside a search result or a home-feed section
     * has none of these — hence all four stay optional here rather than becoming a discriminated union.
     */
    Playlist: {
      id: string;
      title: string;
      description: string | null;
      trackCount: number;
      images: components["schemas"]["Image"][];
      tracks?: components["schemas"]["Track"][];
      entries?: { itemId: string; addedAt: string }[];
      origin?: "user" | "external";
      inLibrary?: boolean;
    };
    Section:
      | { id: string; title: string; subtitle?: string; kind: "tracks"; items: components["schemas"]["Track"][] }
      | { id: string; title: string; subtitle?: string; kind: "albums"; items: components["schemas"]["Album"][] }
      | { id: string; title: string; subtitle?: string; kind: "artists"; items: components["schemas"]["Artist"][] }
      | {
          id: string;
          title: string;
          subtitle?: string;
          kind: "playlists";
          items: components["schemas"]["Playlist"][];
        };
    /** naad's plain Fastify error body: `{ statusCode, error, message }`. See `client.ts`'s `ApiError`. */
    Problem: {
      statusCode: number;
      error: string;
      message: string;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
```

- [ ] **Step 2: Update `src/lib/types.ts` to match**

```typescript
import type { components } from './api/schema';

export type Track = components['schemas']['Track'];
export type Album = components['schemas']['Album'];
export type Artist = components['schemas']['Artist'];
export type ArtistRef = Track['artists'][number];
export type Image = Track['images'][number];
export type Playlist = components['schemas']['Playlist'];
export type Audio = components['schemas']['Audio'];
export type Section = components['schemas']['Section'];
export type Problem = components['schemas']['Problem'];
```

(This drops the old `TrackQuality` and `Source` re-exports — nothing should import those names after
this task; Tasks 2–7 remove every remaining reference.)

- [ ] **Step 3: Confirm the file is syntactically valid**

Run: `npx tsc --noEmit --project . 2>&1 | head -5`
Expected: the command runs (doesn't crash on a syntax error in `schema.d.ts` itself); it will print many
errors from other files that still reference the old types — that's expected at this point in the plan.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/schema.d.ts src/lib/types.ts
git commit -m "refactor(types): replace naad-v3 schema with naad's real shapes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Delete the compat adapter and simplify the API client

**Files:**
- Delete: `src/lib/api/compat.ts`
- Delete: `src/lib/api/compat.test.ts`
- Modify: `src/lib/api/client.ts`
- Modify: `src/lib/api/client.test.ts`

**Interfaces:**
- Consumes: nothing new from Task 1 directly (the client's generic `paths` type already updated).
- Produces: `ApiError`, `isApiError`, `extractErrorCode`, `createAuthMiddleware`, `createApiClient`, `api`,
  `getStoredApiKey`/`setStoredApiKey`, `getStoredEngineUrl`/`setStoredEngineUrl` — all unchanged in name
  and signature from before this task, so no other file needs to change because of this task alone. Later
  tasks call `api.GET('/v1/tracks/{id}/audio', ...)` directly instead of `.../sources`.

- [ ] **Step 1: Delete the compat files**

```bash
git rm src/lib/api/compat.ts src/lib/api/compat.test.ts
```

- [ ] **Step 2: Simplify `src/lib/api/client.ts`**

Remove the `import { adaptResponse, rewriteSourcesUrl, toProblem } from './compat';` line and replace it
with nothing (there is no compat import left). Replace the whole file with:

```typescript
import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

export const API_KEY_STORAGE_KEY = 'naad:apiKey';
export const ENGINE_URL_STORAGE_KEY = 'naad:engineUrl';

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

export function createApiClient(baseUrl?: string, getApiKey: () => string | null = getStoredApiKey) {
  const defaultUrl = typeof window !== 'undefined' ? '/' : 'http://127.0.0.1:8080';
  const url = baseUrl ?? getStoredEngineUrl() ?? defaultUrl;
  const client = createClient<paths>({ baseUrl: url });
  client.use(createAuthMiddleware(getApiKey));
  return client;
}

export const api = createApiClient();
```

Note what's gone: `extractErrorCode` (there is no `type` URI to extract a code suffix from — naad has no
RFC 7807 `type` field), the `schemaPath === '/v1/tracks/{id}/sources'` rewrite branch, and the
`adaptResponse` call — naad's JSON now passes straight through.

- [ ] **Step 3: Rewrite `src/lib/api/client.test.ts`**

```typescript
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
```

- [ ] **Step 4: Run the API layer tests**

Run: `npx vitest run src/lib/api/client.test.ts`
Expected: PASS, all 6 tests green. (`compat.test.ts` no longer exists, so it won't run.)

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/api
git commit -m "refactor(api): delete the naad-v3 compat adapter, simplify the client

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Rebuild the player engine, scheduler, and quality UI around a single Audio source

This is the largest task: `Source`/`alternatives`/`tier`/`delivery`/`normalization`/the proactive
expiry timer/the per-row `quality` sync all flow through one tightly-coupled path from
`engine.svelte.ts` down to `QualityBadge.svelte`, so splitting it further would mean editing the same
files twice for no benefit.

**Files:**
- Modify: `src/lib/player/engine.svelte.ts`
- Modify: `src/lib/player/engine.test.ts`
- Modify: `src/lib/player/scheduler.ts`
- Modify: `src/lib/player/scheduler.test.ts`
- Modify: `src/lib/player/audio-graph.ts`
- Modify: `src/lib/player/math.ts`
- Modify: `src/lib/player/math.test.ts`
- Modify: `src/lib/ui/QualityBadge.svelte`
- Modify: `src/lib/ui/SignalPathCard.svelte`
- Modify: `src/lib/format.ts`
- Modify: `src/lib/format.test.ts`
- Modify: `src/lib/ui/PlayerBar.svelte`
- Modify: `src/routes/now-playing/[[id]]/+page.svelte`
- Modify: `src/routes/kit/+page.svelte`

**Interfaces:**
- Consumes: `Audio` from `$lib/types` (Task 1).
- Produces: `PlayerEngine.currentAudio: Audio | null` (replaces `selectedSource`/`alternatives`),
  `PlayerEngine.resolveAudio(trackId?): Promise<Audio | null>` (replaces `resolveSources`),
  `Scheduler.preloadedTrackInfo: { track: Track; audio: Audio; index: number } | null` (its `sources`
  key renamed to `audio`), `QualityBadge` prop `audio: { codec: string; bitrateKbps: number }` (replaces
  `source`), `SignalPathCard` prop `audio: Audio | null` (replaces `selectedSource`/`alternatives`),
  `AudioGraph.loadAndPlay(url, startPosition?)` / `.preload(url)` (drop the `gainDb` parameter),
  `calculateEffectiveVolume` and `isTokenExpiringSoon` removed from `math.ts` entirely.

- [ ] **Step 1: Update `math.ts` — drop normalization and expiry helpers**

Delete the `calculateEffectiveVolume` and `isTokenExpiringSoon` functions and their doc comments
entirely. The file becomes:

```typescript
/**
 * Pure player mathematics and utility functions.
 * Fully tested via Vitest with zero browser audio dependencies.
 */

/**
 * Formats a Date object as an ISO 8601 string WITH timezone offset (e.g. 2026-09-23T16:20:00+05:30)
 * as required by naad's POST /v1/history contract.
 */
export function formatIsoWithOffset(date = new Date()): string {
  const pad = (num: number, digits = 2) => String(num).padStart(digits, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ms = pad(date.getMilliseconds(), 3);

  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMins = pad(absOffset % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${sign}${offsetHours}:${offsetMins}`;
}

/**
 * Generates a deterministically shuffled copy of an array using Fisher-Yates,
 * preserving an un-shuffle map or the original list.
 */
export function shuffleArray<T>(items: T[], rng = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}
```

- [ ] **Step 2: Update `math.test.ts` — remove the deleted helpers' tests**

Delete the entire `describe('Player Math: calculateEffectiveVolume', ...)` block and the entire
`describe('Player Math: isTokenExpiringSoon', ...)` block. Remove `calculateEffectiveVolume` and
`isTokenExpiringSoon` from the `import` line at the top. The file keeps only the
`formatIsoWithOffset` and `shuffleArray` describe blocks, unchanged.

- [ ] **Step 3: Run the math tests**

Run: `npx vitest run src/lib/player/math.test.ts`
Expected: PASS (2 describe blocks, all tests green).

- [ ] **Step 4: Update `audio-graph.ts` — drop the `gainDb` parameter**

Replace every `calculateEffectiveVolume(this.userVolume, ...)` call with a plain clamp, and drop the
`gainDb` parameters from the public methods. Specifically:

Remove the import line `import { calculateEffectiveVolume } from './math';` and the two private fields
`currentGainDb` / `nextGainDb`.

Change:
```typescript
  async loadAndPlay(url: string, gainDb?: number | null, startPosition = 0): Promise<void> {
    const el = this.activeElement;
    if (!el) return;

    this.cancelCrossfade();
    // Ensure the idle element is stopped so no audio plays simultaneously
    if (this.idleElement) {
      this.idleElement.pause();
      this.idleElement.removeAttribute('src');
      this.idleElement.load();
    }
    this.currentGainDb = gainDb ?? null;
    this.callbacks.onBuffered?.(0);
    el.src = url;
    el.volume = calculateEffectiveVolume(this.userVolume, this.currentGainDb);
```
to:
```typescript
  async loadAndPlay(url: string, startPosition = 0): Promise<void> {
    const el = this.activeElement;
    if (!el) return;

    this.cancelCrossfade();
    // Ensure the idle element is stopped so no audio plays simultaneously
    if (this.idleElement) {
      this.idleElement.pause();
      this.idleElement.removeAttribute('src');
      this.idleElement.load();
    }
    this.callbacks.onBuffered?.(0);
    el.src = url;
    el.volume = this.userVolume;
```

Change:
```typescript
  preload(url: string, gainDb?: number | null) {
    const idle = this.idleElement;
    if (!idle) return;

    this.nextGainDb = gainDb ?? null;
    idle.src = url;
    idle.volume = calculateEffectiveVolume(this.userVolume, this.nextGainDb);
    idle.preload = 'auto';
    idle.load();
  }
```
to:
```typescript
  preload(url: string) {
    const idle = this.idleElement;
    if (!idle) return;

    idle.src = url;
    idle.volume = this.userVolume;
    idle.preload = 'auto';
    idle.load();
  }
```

Change `swapToPreloaded`'s body: remove `this.currentGainDb = this.nextGainDb; this.nextGainDb = null;`
(both lines) and change `nextActive.volume = calculateEffectiveVolume(this.userVolume, this.currentGainDb);`
to `nextActive.volume = this.userVolume;`.

Change `startCrossfade`'s body: remove
`const targetOutVol = calculateEffectiveVolume(this.userVolume, this.currentGainDb);` and
`const targetInVol = calculateEffectiveVolume(this.userVolume, this.nextGainDb);`, replacing both with
`const targetOutVol = this.userVolume;` and `const targetInVol = this.userVolume;`. In the `step`
closure's completion branch, remove `this.currentGainDb = this.nextGainDb; this.nextGainDb = null;`.

Change `setVolume`:
```typescript
  setVolume(volume: number, gainDb?: number | null) {
    this.userVolume = Math.max(0, Math.min(1, volume));
    if (gainDb !== undefined) {
      this.currentGainDb = gainDb;
    }
    if (this.activeElement) {
      this.activeElement.volume = calculateEffectiveVolume(this.userVolume, this.currentGainDb);
    }
  }
```
to:
```typescript
  setVolume(volume: number) {
    this.userVolume = Math.max(0, Math.min(1, volume));
    if (this.activeElement) {
      this.activeElement.volume = this.userVolume;
    }
  }
```

- [ ] **Step 5: Rewrite `scheduler.ts` to use `Audio` directly**

```typescript
import { api } from '$lib/api/client';
import type { Audio, Track } from '$lib/types';
import type { AudioGraph } from './audio-graph';

export interface SchedulerCallbacks {
  onNextTrackReady?: (track: Track, audio: Audio) => void;
  onTrackTransition?: (track: Track, audio: Audio, newIndex: number) => void;
  onEndOfQueue?: () => void;
  onPrefetchDone?: (trackIds: string[]) => void;
}

export class Scheduler {
  private audioGraph: AudioGraph;
  private callbacks: SchedulerCallbacks;
  private prefetchTimeout: ReturnType<typeof setTimeout> | null = null;
  private preloadedTrack: Track | null = null;
  private preloadedAudio: Audio | null = null;
  private preloadedIndex: number | null = null;
  private isPreloading = false;
  private isCrossfadeTriggered = false;

  constructor(audioGraph: AudioGraph, callbacks: SchedulerCallbacks = {}) {
    this.audioGraph = audioGraph;
    this.callbacks = callbacks;
  }

  get preloadedTrackInfo(): { track: Track; audio: Audio; index: number } | null {
    if (this.preloadedTrack && this.preloadedAudio && this.preloadedIndex != null) {
      return {
        track: this.preloadedTrack,
        audio: this.preloadedAudio,
        index: this.preloadedIndex,
      };
    }
    return null;
  }

  /**
   * Called whenever queue or queue index changes. Debounces prefetch requests (1000ms)
   * to respect the 60/min rate limit budget.
   */
  queueChanged(queue: Track[], currentIndex: number) {
    if (this.prefetchTimeout) {
      clearTimeout(this.prefetchTimeout);
      this.prefetchTimeout = null;
    }

    const upcoming = queue.slice(currentIndex + 1, currentIndex + 11);
    const trackIds = upcoming.map((t) => t.id).filter(Boolean);

    if (trackIds.length === 0) return;

    this.prefetchTimeout = setTimeout(async () => {
      this.prefetchTimeout = null;
      try {
        await api.POST('/v1/player/prefetch', {
          body: { trackIds },
        });
        this.callbacks.onPrefetchDone?.(trackIds);
      } catch (err) {
        // Prefetch is an optimization; log and ignore network/rate errors
        console.debug('[Scheduler] Prefetch request completed/failed:', err);
      }
    }, 1000);
  }

  /**
   * Clears any active preloaded track (e.g. if the user skips or jumps manually).
   */
  clearPreload() {
    this.preloadedTrack = null;
    this.preloadedAudio = null;
    this.preloadedIndex = null;
    this.isPreloading = false;
    this.isCrossfadeTriggered = false;
  }

  /**
   * Computes the next track index given current index, queue, and repeat mode.
   */
  getNextIndex(currentIndex: number, queueLength: number, repeat: 'off' | 'all' | 'one'): number {
    if (queueLength === 0) return -1;
    if (repeat === 'one') return currentIndex;
    if (currentIndex + 1 < queueLength) {
      return currentIndex + 1;
    }
    if (repeat === 'all') {
      return 0;
    }
    return -1;
  }

  /**
   * Preloads the next track into the idle audio element for gapless handoff.
   */
  async prepareNextTrack(queue: Track[], currentIndex: number, repeat: 'off' | 'all' | 'one'): Promise<void> {
    const nextIdx = this.getNextIndex(currentIndex, queue.length, repeat);
    if (nextIdx < 0 || nextIdx >= queue.length) {
      this.clearPreload();
      return;
    }

    const nextTrack = queue[nextIdx];
    if (!nextTrack) return;

    // If already preloaded for this track, do nothing
    if (this.preloadedTrack?.id === nextTrack.id && this.preloadedIndex === nextIdx) {
      return;
    }

    if (this.isPreloading) return;
    this.clearPreload();
    this.isPreloading = true;

    try {
      const { data, error } = await api.GET('/v1/tracks/{id}/audio', {
        params: { path: { id: nextTrack.id } },
      });

      if (error || !data?.url) {
        console.warn('[Scheduler] Failed to resolve audio for preloading:', error);
        this.isPreloading = false;
        return;
      }

      this.preloadedTrack = nextTrack;
      this.preloadedAudio = data;
      this.preloadedIndex = nextIdx;
      this.isPreloading = false;
      this.isCrossfadeTriggered = false;

      // Preload into the idle audio element
      this.audioGraph.preload(data.url);
      this.callbacks.onNextTrackReady?.(nextTrack, data);
    } catch (err) {
      console.warn('[Scheduler] Preload error:', err);
      this.isPreloading = false;
    }
  }

  /**
   * Checks whether crossfade should be triggered during playback.
   * Crossfade is explicitly SKIPPED between consecutive tracks of the same album
   * so continuous albums remain truly gapless.
   */
  checkCrossfade(
    currentTrack: Track | null,
    currentTime: number,
    duration: number,
    crossfadeSeconds: number,
  ): boolean {
    if (
      crossfadeSeconds <= 0 ||
      duration <= crossfadeSeconds ||
      this.isCrossfadeTriggered ||
      !this.preloadedTrack ||
      !this.preloadedAudio ||
      this.preloadedIndex == null
    ) {
      return false;
    }

    // Skip crossfade if consecutive tracks belong to the same album
    const isSameAlbum = Boolean(
      currentTrack?.album?.id &&
        this.preloadedTrack.album?.id &&
        currentTrack.album.id === this.preloadedTrack.album.id,
    );

    if (isSameAlbum) {
      return false;
    }

    const remainingTime = duration - currentTime;
    if (remainingTime <= crossfadeSeconds && remainingTime > 0) {
      this.isCrossfadeTriggered = true;
      const targetTrack = this.preloadedTrack;
      const targetAudio = this.preloadedAudio;
      const targetIndex = this.preloadedIndex;

      this.audioGraph.startCrossfade(crossfadeSeconds, () => {
        this.clearPreload();
        this.callbacks.onTrackTransition?.(targetTrack, targetAudio, targetIndex);
      });
      return true;
    }

    return false;
  }

  /**
   * Handles track ended event: swaps to preloaded element if available,
   * or signals end of queue.
   */
  async handleTrackEnded(
    queue: Track[],
    currentIndex: number,
    repeat: 'off' | 'all' | 'one',
  ): Promise<boolean> {
    if (this.isCrossfadeTriggered) {
      // Crossfade is already in progress / handled the swap
      return true;
    }

    if (this.preloadedTrack && this.preloadedAudio && this.preloadedIndex != null) {
      const targetTrack = this.preloadedTrack;
      const targetAudio = this.preloadedAudio;
      const targetIndex = this.preloadedIndex;

      this.clearPreload();
      await this.audioGraph.swapToPreloaded();
      this.callbacks.onTrackTransition?.(targetTrack, targetAudio, targetIndex);
      return true;
    }

    // If preloaded track was not ready, check if there's a next index to load
    const nextIdx = this.getNextIndex(currentIndex, queue.length, repeat);
    if (nextIdx < 0 || nextIdx >= queue.length) {
      this.callbacks.onEndOfQueue?.();
      return false;
    }

    return false;
  }

  destroy() {
    if (this.prefetchTimeout) {
      clearTimeout(this.prefetchTimeout);
      this.prefetchTimeout = null;
    }
    this.clearPreload();
  }
}
```

- [ ] **Step 6: Rewrite `scheduler.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import type { Audio, Track } from '$lib/types';
import { AudioGraph } from './audio-graph';
import { Scheduler } from './scheduler';

function createDummyTrack(id: string, albumId?: string): Track {
  return {
    id,
    title: `Track ${id}`,
    artists: [{ id: 'art_1', name: 'Artist' }],
    album: albumId ? { id: albumId, title: `Album ${albumId}`, images: [] } : null,
    durationMs: 200_000,
    explicit: false,
    trackNumber: 1,
    images: [],
    url: null,
  };
}

const dummyAudio: Audio = {
  url: 'https://example.com/stream.mp4',
  bitrateKbps: 320,
  codec: 'aac',
  mimeType: 'audio/mp4',
  durationMs: 200_000,
};

describe('Scheduler: getNextIndex', () => {
  const dummyGraph = new AudioGraph();
  const scheduler = new Scheduler(dummyGraph);

  it('advances sequentially when repeat is off', () => {
    expect(scheduler.getNextIndex(0, 5, 'off')).toBe(1);
    expect(scheduler.getNextIndex(1, 5, 'off')).toBe(2);
    expect(scheduler.getNextIndex(3, 5, 'off')).toBe(4);
    // End of queue
    expect(scheduler.getNextIndex(4, 5, 'off')).toBe(-1);
  });

  it('wraps to 0 at the end of queue when repeat is all', () => {
    expect(scheduler.getNextIndex(0, 5, 'all')).toBe(1);
    expect(scheduler.getNextIndex(4, 5, 'all')).toBe(0);
  });

  it('returns current index when repeat is one', () => {
    expect(scheduler.getNextIndex(2, 5, 'one')).toBe(2);
    expect(scheduler.getNextIndex(4, 5, 'one')).toBe(4);
  });

  it('returns -1 for empty queue', () => {
    expect(scheduler.getNextIndex(0, 0, 'off')).toBe(-1);
    expect(scheduler.getNextIndex(0, 0, 'all')).toBe(-1);
    expect(scheduler.getNextIndex(0, 0, 'one')).toBe(-1);
  });
});

describe('Scheduler: checkCrossfade album boundary logic', () => {
  it('skips crossfade between consecutive tracks of the SAME album to preserve gapless playback', () => {
    const dummyGraph = new AudioGraph();
    const scheduler = new Scheduler(dummyGraph);

    const track1 = createDummyTrack('trk_1', 'alb_same');
    const track2 = createDummyTrack('trk_2', 'alb_same');

    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedTrack = track2;
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedAudio = dummyAudio;
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedIndex = 1;

    // With 5s remaining and 6s crossfade, should return FALSE because same album!
    const result = scheduler.checkCrossfade(track1, 195, 200, 6);
    expect(result).toBe(false);
  });

  it('triggers crossfade when consecutive tracks are from DIFFERENT albums and remaining time <= crossfadeSeconds', () => {
    const dummyGraph = new AudioGraph();
    const scheduler = new Scheduler(dummyGraph);

    const track1 = createDummyTrack('trk_1', 'alb_A');
    const track2 = createDummyTrack('trk_2', 'alb_B');

    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedTrack = track2;
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedAudio = dummyAudio;
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedIndex = 1;

    // Remaining time 4s <= crossfade 6s -> triggers crossfade!
    const result = scheduler.checkCrossfade(track1, 196, 200, 6);
    expect(result).toBe(true);
  });
});
```

- [ ] **Step 7: Run the scheduler tests**

Run: `npx vitest run src/lib/player/scheduler.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 8: Rewrite `engine.svelte.ts`**

Change the import line:
```typescript
import type { Source, Track } from '$lib/types';
```
to:
```typescript
import type { Audio, Track } from '$lib/types';
```
and remove `import { formatIsoWithOffset, isTokenExpiringSoon, shuffleArray } from './math';` in favor
of:
```typescript
import { formatIsoWithOffset, shuffleArray } from './math';
```
and change:
```typescript
import { type ResolvedSources, Scheduler } from './scheduler';
```
to:
```typescript
import { Scheduler } from './scheduler';
```

Change the state fields:
```typescript
  currentTrack = $state<Track | null>(null);
  selectedSource = $state<Source | null>(null);
  alternatives = $state<Source[]>([]);
  currentPlayUrl = $state<string | null>(null);
  currentExpiresAt = $state<string | null>(null);
```
to:
```typescript
  currentTrack = $state<Track | null>(null);
  currentAudio = $state<Audio | null>(null);
  currentPlayUrl = $state<string | null>(null);
```

Remove the private field `private isRefreshingToken = false;`.

Change the constructor's `onTimeUpdate` callback:
```typescript
      onTimeUpdate: (time) => {
        if (!this.currentTrack) {
          this.audioGraph.pause();
          return;
        }
        this.currentTime = time;
        this.mediaSession.setPositionState(this.duration, time);
        this.scheduler.checkCrossfade(this.currentTrack, time, this.duration, this.crossfadeSeconds);
        this.checkProactiveExpiry();
      },
```
to:
```typescript
      onTimeUpdate: (time) => {
        if (!this.currentTrack) {
          this.audioGraph.pause();
          return;
        }
        this.currentTime = time;
        this.mediaSession.setPositionState(this.duration, time);
        this.scheduler.checkCrossfade(this.currentTrack, time, this.duration, this.crossfadeSeconds);
      },
```

Change the `scheduler` construction callback:
```typescript
    this.scheduler = new Scheduler(this.audioGraph, {
      onTrackTransition: (track, sourcesData, newIndex) => {
        this.recordCurrentListen(true);
        this.applyTrackTransition(track, sourcesData, newIndex);
      },
```
to:
```typescript
    this.scheduler = new Scheduler(this.audioGraph, {
      onTrackTransition: (track, audio, newIndex) => {
        this.recordCurrentListen(true);
        this.applyTrackTransition(track, audio, newIndex);
      },
```

Change `applyTrackTransition`:
```typescript
  private applyTrackTransition(track: Track, sourcesData: ResolvedSources, newIndex: number) {
    this.currentTrack = track;
    this.selectedSource = sourcesData.selected;
    this.alternatives = sourcesData.alternatives ?? [];
    this.currentPlayUrl = sourcesData.play.url;
    this.currentExpiresAt = sourcesData.play.expiresAt;
    this.queueIndex = newIndex;
```
to:
```typescript
  private applyTrackTransition(track: Track, audio: Audio, newIndex: number) {
    this.currentTrack = track;
    this.currentAudio = audio;
    this.currentPlayUrl = audio.url;
    this.queueIndex = newIndex;
```

Change `handleAudioError`:
```typescript
  private async handleAudioError(err: MediaError | null) {
    console.warn('[PlayerEngine] Media error caught:', err);
    if (!this.currentTrack) return;

    if (this.retryCount === 0) {
      this.retryCount++;
      const savedPos = this.currentTime;
      console.info(
        `[PlayerEngine] Refreshing token for "${this.currentTrack.title}" at position ${savedPos}s`,
      );

      try {
        const { data, error } = await api.GET('/v1/tracks/{id}/sources', {
          params: {
            path: { id: this.currentTrack.id },
            query: { refresh: 'true' },
          },
        });

        if (error || !data?.play?.url) {
          throw error ?? new Error('No play URL returned on refresh');
        }

        this.selectedSource = data.selected;
        this.currentPlayUrl = data.play.url;
        this.currentExpiresAt = data.play.expiresAt;
        await this.audioGraph.loadAndPlay(data.play.url, null, savedPos);
        return;
      } catch (refreshErr) {
        console.warn('[PlayerEngine] Recovery with refresh token failed:', refreshErr);
      }
    }

    toast.push(`Couldn't play "${this.currentTrack.title}", skipped`, { tone: 'danger' });
    this.next();
  }
```
to:
```typescript
  private async handleAudioError(err: MediaError | null) {
    console.warn('[PlayerEngine] Media error caught:', err);
    if (!this.currentTrack) return;

    if (this.retryCount === 0) {
      this.retryCount++;
      const savedPos = this.currentTime;
      console.info(`[PlayerEngine] Re-resolving audio for "${this.currentTrack.title}" at position ${savedPos}s`);

      try {
        const { data, error } = await api.GET('/v1/tracks/{id}/audio', {
          params: {
            path: { id: this.currentTrack.id },
            query: { refresh: true },
          },
        });

        if (error || !data?.url) {
          throw error ?? new Error('No audio URL returned on refresh');
        }

        this.currentAudio = data;
        this.currentPlayUrl = data.url;
        await this.audioGraph.loadAndPlay(data.url, savedPos);
        return;
      } catch (refreshErr) {
        console.warn('[PlayerEngine] Recovery with a fresh audio lookup failed:', refreshErr);
      }
    }

    toast.push(`Couldn't play "${this.currentTrack.title}", skipped`, { tone: 'danger' });
    this.next();
  }
```

Delete the entire `checkProactiveExpiry` method (naad's `/audio` links have no signed, client-visible
expiry to proactively refresh ahead of — the reactive path above, triggered by the `<audio>` element's
own `error` event, is the only recovery naad needs).

Change `recordCurrentListen`:
```typescript
  private recordCurrentListen(completed = false) {
    if (!this.currentTrack || !this.listenStartTime) return;
    const msPlayed = Date.now() - this.listenStartTime;
    if (msPlayed > 1000) {
      this.historyTracker.record({
        trackId: this.currentTrack.id,
        startedAt: this.listenStartIso,
        msPlayed,
        completed,
        context: this.listenContext,
        sourceProvider: this.selectedSource?.provider,
      });
    }
    this.listenStartTime = null;
  }
```
to:
```typescript
  private recordCurrentListen(completed = false) {
    if (!this.currentTrack || !this.listenStartTime) return;
    const msPlayed = Date.now() - this.listenStartTime;
    if (msPlayed > 1000) {
      this.historyTracker.record({
        trackId: this.currentTrack.id,
        startedAt: this.listenStartIso,
        msPlayed,
        completed,
        context: this.listenContext,
      });
    }
    this.listenStartTime = null;
  }
```
(`sourceProvider` is dropped: naad has exactly one provider, so the field would carry zero information.)

Change `play()`'s guard (`if (this.currentPlayUrl && ...)` stays the same — it doesn't reference
`Source`, no change needed there).

Change `playTrack`:
```typescript
    try {
      const { data, error } = await api.GET('/v1/tracks/{id}/sources', {
        params: {
          path: { id: track.id },
        },
      });

      if (error || !data || !data.play?.url) {
        throw error ?? new Error('No playable source found');
      }

      this.selectedSource = data.selected;
      this.alternatives = data.alternatives ?? [];
      this.currentPlayUrl = data.play.url;
      this.currentExpiresAt = data.play.expiresAt;

      if (data.selected) {
        this.currentTrack = {
          ...track,
          quality: {
            tier: data.selected.tier,
            codec: data.selected.codec,
            bitDepth: data.selected.bitDepth,
            sampleRate: data.selected.sampleRate,
            bitrateKbps: data.selected.bitrateKbps,
            provider: data.selected.provider,
            verifiedAt: data.selected.verifiedAt,
          },
        };
      }
      await this.audioGraph.loadAndPlay(data.play.url, null, 0);
```
to:
```typescript
    try {
      const { data, error } = await api.GET('/v1/tracks/{id}/audio', {
        params: {
          path: { id: track.id },
        },
      });

      if (error || !data?.url) {
        throw error ?? new Error('No playable audio found');
      }

      this.currentAudio = data;
      this.currentPlayUrl = data.url;
      await this.audioGraph.loadAndPlay(data.url, 0);
```

Change `next()`'s preloaded-track swap branch:
```typescript
      const preloaded = this.scheduler.preloadedTrackInfo;
      if (preloaded && preloaded.index === nextIdx) {
        // playTrack() records what it leaves; this path swaps tracks without it, so the skipped listen was lost.
        this.recordCurrentListen(false);
        await this.audioGraph.swapToPreloaded();
        this.applyTrackTransition(preloaded.track, preloaded.sources, nextIdx);
      } else {
```
to:
```typescript
      const preloaded = this.scheduler.preloadedTrackInfo;
      if (preloaded && preloaded.index === nextIdx) {
        // playTrack() records what it leaves; this path swaps tracks without it, so the skipped listen was lost.
        this.recordCurrentListen(false);
        await this.audioGraph.swapToPreloaded();
        this.applyTrackTransition(preloaded.track, preloaded.audio, nextIdx);
      } else {
```
(`preloadedTrackInfo`'s `sources` key was renamed to `audio` in Step 5 above — this is the one other
place in `engine.svelte.ts` that reads it.)

Change `resolveSources`:
```typescript
  async resolveSources(trackId?: string): Promise<Source | null> {
    const targetId = trackId ?? this.currentTrack?.id;
    if (!targetId) return null;
    try {
      const { data, error } = await api.GET('/v1/tracks/{id}/sources', {
        params: {
          path: { id: targetId },
        },
      });
      if (error || !data?.selected) return null;
      if (this.currentTrack && this.currentTrack.id === targetId) {
        this.selectedSource = data.selected;
        this.alternatives = data.alternatives ?? [];
        this.currentTrack = {
          ...this.currentTrack,
          quality: {
            tier: data.selected.tier,
            codec: data.selected.codec,
            bitDepth: data.selected.bitDepth,
            sampleRate: data.selected.sampleRate,
            bitrateKbps: data.selected.bitrateKbps,
            provider: data.selected.provider,
            verifiedAt: data.selected.verifiedAt,
          },
        };
        this.saveSession();
      }
      return data.selected;
    } catch {
      return null;
    }
  }
```
to:
```typescript
  async resolveAudio(trackId?: string): Promise<Audio | null> {
    const targetId = trackId ?? this.currentTrack?.id;
    if (!targetId) return null;
    try {
      const { data, error } = await api.GET('/v1/tracks/{id}/audio', {
        params: {
          path: { id: targetId },
        },
      });
      if (error || !data) return null;
      if (this.currentTrack && this.currentTrack.id === targetId) {
        this.currentAudio = data;
        this.saveSession();
      }
      return data;
    } catch {
      return null;
    }
  }
```

- [ ] **Step 9: Update `engine.test.ts`**

Change `expect(player.selectedSource).toBeNull();` to `expect(player.currentAudio).toBeNull();`.

Rename the test `'commitSeek clamps within duration for non-proxy delivery'` to
`'commitSeek clamps within duration'` and remove the now-meaningless comment line
`// No selectedSource → non-proxy path` from inside it.

In the `'records the listen of the track it leaves when skipping to a preloaded next track'` test,
change:
```typescript
    vi.spyOn(scheduler, 'preloadedTrackInfo', 'get').mockReturnValue({
      track: b!,
      index: 1,
      sources: {
        selected: { id: 's', provider: 'jiosaavn' },
        alternatives: [],
        play: { url: 'https://cdn.example/b.mp4', expiresAt: '2099-01-01T00:00:00.000Z' },
      },
    } as never);
```
to:
```typescript
    vi.spyOn(scheduler, 'preloadedTrackInfo', 'get').mockReturnValue({
      track: b!,
      index: 1,
      audio: {
        url: 'https://cdn.example/b.mp4',
        bitrateKbps: 320,
        codec: 'aac',
        mimeType: 'audio/mp4',
        durationMs: 200_000,
      },
    } as never);
```

Add a new test to the `describe('PlayerEngine', ...)` block covering the complete-failure fallback path
(Review Focus item 5: a track whose audio lookup fails entirely, including the retry, must still fall
through to "toast + skip to next" rather than getting stuck):
```typescript
  it('skips to the next track when audio fails and the refresh retry also fails', async () => {
    const { api } = await import('$lib/api/client');
    const getSpy = vi.spyOn(api, 'GET').mockResolvedValue({
      data: undefined,
      error: { statusCode: 500, error: 'Internal Server Error', message: 'boom' },
      response: new Response(),
    } as never);
    const nextSpy = vi.spyOn(player, 'next').mockImplementation(async () => {});

    player.currentTrack = tracks[0]!;
    // @ts-expect-error private, reached for this test only
    player.retryCount = 0;
    // @ts-expect-error private method, reached for this test only
    await player.handleAudioError(null);

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(nextSpy).toHaveBeenCalledTimes(1);

    getSpy.mockRestore();
    nextSpy.mockRestore();
  });
```

- [ ] **Step 10: Run the engine tests**

Run: `npx vitest run src/lib/player/engine.test.ts`
Expected: PASS, all 12 tests green (10 in `describe('PlayerEngine', ...)`, 1 in
`describe('listening history', ...)`, plus the new one just added). (This exercises Task 1's fixtures
too, but fixtures.ts still has
extra fields at this point in the plan — harmless at runtime since Vitest doesn't type-check; Task 7
cleans fixtures.ts up for `npm run check`.)

- [ ] **Step 11: Simplify `format.ts`'s `describeQuality`**

Replace the `Tier`/`QualityInfo`/`describeQuality` block:
```typescript
export type Tier = 'hires' | 'lossless' | 'high' | 'standard';

export interface QualityInfo {
  tier: Tier;
  label: string; // short badge text, e.g. "HI-RES · FLAC 24/96"
  detail: string; // long form for the Signal path card
}

/** Mirrors the engine's tier semantics (naad-v3 src/modules/playback/types.ts). */
export function describeQuality(source: {
  tier: Tier;
  codec: string;
  bitDepth?: number | null;
  sampleRate?: number | null;
  bitrateKbps?: number | null;
}): QualityInfo {
  const codec = source.codec.toUpperCase();
  if (source.tier === 'hires' && source.bitDepth && source.sampleRate) {
    const khz = (source.sampleRate / 1000).toFixed(source.sampleRate % 1000 === 0 ? 0 : 1);
    return {
      tier: 'hires',
      label: `HI-RES · ${codec} ${source.bitDepth}/${khz}`,
      detail: `${codec}, ${source.bitDepth}-bit / ${khz} kHz`,
    };
  }
  if (source.tier === 'lossless' && source.bitDepth && source.sampleRate) {
    const khz = (source.sampleRate / 1000).toFixed(source.sampleRate % 1000 === 0 ? 0 : 1);
    return {
      tier: 'lossless',
      label: `LOSSLESS · ${codec} ${source.bitDepth}/${khz}`,
      detail: `${codec}, ${source.bitDepth}-bit / ${khz} kHz`,
    };
  }
  if (source.bitrateKbps) {
    return {
      tier: source.tier === 'high' ? 'high' : 'standard',
      label: `${codec} ${source.bitrateKbps}`,
      detail: `${codec}, ${source.bitrateKbps} kbps`,
    };
  }
  return { tier: source.tier, label: codec, detail: codec };
}
```
with:
```typescript
export interface QualityInfo {
  label: string; // short badge text, e.g. "AAC 320"
  detail: string; // long form for the Signal path card
}

/** naad's whole catalog tops out at AAC 320kbps, so there is exactly one badge shape to render. */
export function describeQuality(audio: { codec: string; bitrateKbps: number }): QualityInfo {
  const codec = audio.codec.toUpperCase();
  return {
    label: `${codec} ${audio.bitrateKbps}`,
    detail: `${codec}, ${audio.bitrateKbps} kbps`,
  };
}
```

- [ ] **Step 12: Update `format.test.ts`**

Replace the `'formats quality info for hires, lossless and high'` test with:
```typescript
  it('formats quality info from codec and bitrate', () => {
    const info = describeQuality({ codec: 'aac', bitrateKbps: 320 });
    expect(info.label).toBe('AAC 320');
    expect(info.detail).toBe('AAC, 320 kbps');
  });
```

- [ ] **Step 13: Run the format tests**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 14: Simplify `QualityBadge.svelte`**

```svelte
<script lang="ts">
import { goto } from '$app/navigation';
import { describeQuality } from '$lib/format';
import { player } from '$lib/player/engine.svelte';

interface Props {
  audio: { codec: string; bitrateKbps: number };
  /** Renders as a plain <span> instead of a <button> (e.g. inside a row that's already clickable). */
  interactive?: boolean;
  onclick?: () => void;
}

let { audio, interactive = true, onclick }: Props = $props();
const info = $derived(describeQuality(audio));
</script>

{#snippet content()}
  <span class="size-[5px] rounded-full bg-ink-faint" aria-hidden="true"></span>
  <span class="font-mono text-2xs uppercase tracking-wide" data-numeric>{info.label}</span>
{/snippet}

{#if interactive}
  <button
    type="button"
    onclick={onclick ?? (() => goto(player.currentTrack ? `/now-playing/${player.currentTrack.id}?tab=signal` : '/now-playing?tab=signal'))}
    class="inline-flex items-center gap-1.5 border-b border-transparent text-ink-muted hover:border-border-strong hover:text-ink transition-colors duration-[var(--duration-fast)]"
    aria-label="Playback quality: {info.detail}. View signal path."
  >
    {@render content()}
  </button>
{:else}
  <span class="inline-flex items-center gap-1.5 text-ink-muted" aria-label="Playback quality: {info.detail}">
    {@render content()}
  </span>
{/if}
```

(The dot is now always the plain ink-faint color — with one real tier, amber no longer has anything to
single out.)

- [ ] **Step 15: Simplify `SignalPathCard.svelte`**

```svelte
<script lang="ts">
import { formatBitrate } from '$lib/format';
import type { Audio } from '$lib/types';
import QualityBadge from './QualityBadge.svelte';

interface Props {
  audio: Audio | null;
}

let { audio }: Props = $props();
</script>

<div class="flex flex-col gap-6 p-6 rounded-sm border border-border bg-surface-1 select-none">
  <!-- Header: Hi-fi panel styling -->
  <div class="flex items-center justify-between pb-4 border-b border-border">
    <div>
      <p class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Technical Readout</p>
      <h2 class="text-base font-semibold text-ink mt-0.5 tracking-tight">Signal Path</h2>
    </div>
    {#if audio}
      <QualityBadge {audio} interactive={false} />
    {/if}
  </div>

  {#if audio}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="flex flex-col gap-1 p-3 rounded-xs border border-border bg-surface-2">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-muted">Codec & Container</span>
        <span class="font-mono text-sm text-ink uppercase">
          {audio.codec} <span class="text-ink-muted font-normal text-xs">({audio.mimeType})</span>
        </span>
      </div>

      <div class="flex flex-col gap-1 p-3 rounded-xs border border-border bg-surface-2">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-muted">Stream Bitrate</span>
        <span class="font-mono text-sm text-ink" data-numeric>
          {formatBitrate(audio.bitrateKbps)}
        </span>
      </div>
    </div>
  {:else}
    <div class="py-8 text-center text-xs text-ink-muted">
      No technical source stream resolved for the current track.
    </div>
  {/if}
</div>
```

(`formatSampleRate` is no longer used here — naad's `Audio` has no `sampleRate` field — so it's dropped
from the import. Delivery Protocol, Alternatives, Catalog Provider, Normalization Calibration, and Source
Verified At are all gone: naad has no delivery modes, no alternates, exactly one provider, no
normalization data, and no verification timestamp.)

- [ ] **Step 16: Update `PlayerBar.svelte`**

Change:
```svelte
    {#if player.selectedSource}
      <QualityBadge source={player.selectedSource} />
    {/if}
```
to:
```svelte
    {#if player.currentAudio}
      <QualityBadge audio={player.currentAudio} />
    {/if}
```

- [ ] **Step 17: Update `now-playing/[[id]]/+page.svelte`**

Delete the entire "Sync server metadata (e.g. newly upgraded quality) into currentTrack" `$effect`
block:
```svelte
// Sync server metadata (e.g. newly upgraded quality) into currentTrack
$effect(() => {
  if (routeTrackQuery.data && player.currentTrack?.id === routeTrackQuery.data.id) {
    if (
      routeTrackQuery.data.quality &&
      (!player.currentTrack.quality ||
        player.currentTrack.quality.tier !== routeTrackQuery.data.quality.tier ||
        player.currentTrack.quality.provider !== routeTrackQuery.data.quality.provider)
    ) {
      player.currentTrack = { ...player.currentTrack, quality: routeTrackQuery.data.quality };
    }
  }
});

```
(naad never sends a per-track `quality` field at all, so this can never fire — it's dead.)

Change:
```svelte
// If viewing the Signal path tab or current source is unresolved, resolve technical source
$effect(() => {
  if (activeTab === 'signal' && player.currentTrack && !player.selectedSource) {
    void player.resolveSources(player.currentTrack.id);
  }
});
```
to:
```svelte
// If viewing the Signal path tab and audio for the current track hasn't been resolved yet, resolve it
$effect(() => {
  if (activeTab === 'signal' && player.currentTrack && !player.currentAudio) {
    void player.resolveAudio(player.currentTrack.id);
  }
});
```

Change:
```svelte
          <!-- Quality Readout: Click switches directly to Signal path tab -->
          <div class="mt-2 flex items-center justify-center lg:justify-start gap-2">
            {#if player.selectedSource}
              <QualityBadge
                source={player.selectedSource}
                onclick={() => switchTab('signal')}
              />
            {:else if player.currentTrack?.quality}
              <QualityBadge
                source={player.currentTrack.quality}
                onclick={() => switchTab('signal')}
              />
            {/if}
          </div>
```
to:
```svelte
          <!-- Quality Readout: Click switches directly to Signal path tab -->
          <div class="mt-2 flex items-center justify-center lg:justify-start gap-2">
            {#if player.currentAudio}
              <QualityBadge
                audio={player.currentAudio}
                onclick={() => switchTab('signal')}
              />
            {/if}
          </div>
```

Change:
```svelte
          {:else if activeTab === 'signal'}
            <!-- Signal Path Technical Card -->
            <div class="h-full w-full overflow-y-auto py-4">
              <SignalPathCard
                selectedSource={player.selectedSource}
                alternatives={player.alternatives}
              />
            </div>
          {/if}
```
to:
```svelte
          {:else if activeTab === 'signal'}
            <!-- Signal Path Technical Card -->
            <div class="h-full w-full overflow-y-auto py-4">
              <SignalPathCard audio={player.currentAudio} />
            </div>
          {/if}
```

- [ ] **Step 18: Update `kit/+page.svelte`'s quality-badge section**

Change:
```svelte
    <!-- ============================================================ Quality badges ============================================================ -->
    <section class="space-y-4">
      <h2 class="text-2xs uppercase tracking-wider text-ink-faint">Quality readout — the signature element</h2>
      <div class="flex flex-wrap items-center gap-6 border-y border-border py-4">
        <QualityBadge source={{ tier: 'hires', codec: 'flac', bitDepth: 24, sampleRate: 96000 }} interactive={false} />
        <QualityBadge source={{ tier: 'lossless', codec: 'flac', bitDepth: 16, sampleRate: 44100 }} interactive={false} />
        <QualityBadge source={{ tier: 'high', codec: 'aac', bitrateKbps: 320 }} interactive={false} />
        <QualityBadge source={{ tier: 'standard', codec: 'opus', bitrateKbps: 160 }} interactive={false} />
        <QualityBadge source={tracks[0]!.quality!} onclick={() => toast.push('Signal path card opens here (Phase B).')} />
      </div>
    </section>
```
to:
```svelte
    <!-- ============================================================ Quality badges ============================================================ -->
    <section class="space-y-4">
      <h2 class="text-2xs uppercase tracking-wider text-ink-faint">Quality readout — the signature element</h2>
      <div class="flex flex-wrap items-center gap-6 border-y border-border py-4">
        <QualityBadge audio={{ codec: 'aac', bitrateKbps: 320 }} interactive={false} />
        <QualityBadge audio={{ codec: 'aac', bitrateKbps: 160 }} interactive={false} />
        <QualityBadge audio={{ codec: 'aac', bitrateKbps: 320 }} onclick={() => toast.push('Signal path card opens here (Phase B).')} />
      </div>
    </section>
```

- [ ] **Step 19: Run every player and format test together**

Run: `npx vitest run src/lib/player src/lib/format.test.ts src/lib/api/client.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 20: Commit**

```bash
git add -A src/lib/player src/lib/ui/QualityBadge.svelte src/lib/ui/SignalPathCard.svelte \
  src/lib/format.ts src/lib/format.test.ts src/routes/now-playing src/routes/kit
git commit -m "refactor(player): rebuild playback and quality UI around naad's single Audio source

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Bug fix — history flush respects the configured Engine URL

**Files:**
- Modify: `src/lib/player/history.ts`
- Modify: `src/lib/player/history.test.ts`

**Interfaces:**
- Consumes: `getStoredEngineUrl` from `$lib/api/client` (already existed before this task).
- Produces: no change to `HistoryTracker`'s public API (`record`, `flush`, `getPendingCount`,
  `getPendingItems`, `destroy` all keep the same signatures).

- [ ] **Step 1: Update `history.ts`'s `flush()` to resolve against the configured engine URL**

Add the import:
```typescript
import { getStoredEngineUrl } from '$lib/api/client';
```
at the top, alongside the existing `import { formatIsoWithOffset } from './math';`.

Change:
```typescript
    if (typeof fetch !== 'undefined') {
      fetch('/v1/history', {
        method: 'POST',
        headers,
        body: JSON.stringify({ listens: itemsToSend }),
        keepalive: true,
      }).catch((err) => {
```
to:
```typescript
    if (typeof fetch !== 'undefined') {
      const base = getStoredEngineUrl() ?? '';
      fetch(`${base}/v1/history`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ listens: itemsToSend }),
        keepalive: true,
      }).catch((err) => {
```

- [ ] **Step 2: Add a failing test for the bug**

Add this test to `history.test.ts`, inside the existing `describe('HistoryTracker', ...)` block:
```typescript
  it('flushes to the configured Engine URL, not the page origin, when one is set', () => {
    localStorage.setItem('naad:engineUrl', 'https://remote-engine.example');
    const tracker = new HistoryTracker();
    tracker.record({ trackId: 'trk_remote', msPlayed: 15000 });
    tracker.flush();

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://remote-engine.example/v1/history',
      expect.objectContaining({ method: 'POST' }),
    );
    tracker.destroy();
    localStorage.removeItem('naad:engineUrl');
  });
```

- [ ] **Step 3: Run the test and confirm it fails without the fix, then passes with it**

Run: `npx vitest run src/lib/player/history.test.ts`
Expected: with Step 1 already applied, all 5 tests PASS (4 existing + the new one). If you're verifying
TDD-style, temporarily revert Step 1's change, confirm this specific test fails with the fetch URL
`/v1/history` instead of `https://remote-engine.example/v1/history`, then reapply Step 1.

- [ ] **Step 4: Commit**

```bash
git add src/lib/player/history.ts src/lib/player/history.test.ts
git commit -m "fix(history): flush to the configured Engine URL instead of the page origin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Bug fix — artwork proxy is no longer bypassed for CORS-sensitive reads

**Files:**
- Modify: `src/lib/art.ts`
- Modify: `src/lib/color/ambient.ts`
- Test: `src/lib/art.test.ts` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: `artUrl(src, size)` keeps its existing signature and behavior for plain `<img>` display
  call sites (`TrackRow`, `PlayerBar`, `now-playing` page's queue list, album/artist pages via
  `bestImageUrl`). A new `corsArtUrl(src, size)` is added for the one call site that reads pixels off a
  canvas.

- [ ] **Step 1: Write the failing test first**

Create `src/lib/art.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { artUrl, corsArtUrl } from './art';

describe('artUrl', () => {
  it('returns a saavncdn.com URL directly for plain display (no CORS needed)', () => {
    const url = artUrl('https://c.saavncdn.com/396/cover-150x150.jpg', 150);
    expect(url).toContain('saavncdn.com');
    expect(url?.startsWith('/v1/art')).toBe(false);
  });
});

describe('corsArtUrl', () => {
  it('always proxies through /v1/art, even for saavncdn.com sources', () => {
    const url = corsArtUrl('https://c.saavncdn.com/396/cover-150x150.jpg', 64);
    expect(url?.startsWith('/v1/art?')).toBe(true);
    expect(url).toContain('saavncdn.com');
  });

  it('returns undefined for a missing source', () => {
    expect(corsArtUrl(undefined, 64)).toBeUndefined();
    expect(corsArtUrl(null, 64)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/art.test.ts`
Expected: FAIL with `corsArtUrl is not exported` (it doesn't exist yet).

- [ ] **Step 3: Add `corsArtUrl` to `art.ts` and keep `artUrl` for plain display**

`artUrl`'s current bug is that it special-cases `saavncdn.com` and returns it unproxied — which is
*correct* for plain `<img src>` display (skips a network hop for the common case) but *wrong* for the
one caller that needs CORS-readable pixels (`ambient.ts`, via `<img crossOrigin="anonymous">`). Rather
than have `artUrl` guess which the caller needs, split the concern: `artUrl` keeps exactly its current
behavior (used everywhere images are just displayed), and a new `corsArtUrl` always goes through the
proxy, since that's the only thing the proxy exists to guarantee.

Add this function to `art.ts`, right after the existing `artUrl` function:
```typescript
/**
 * Like `artUrl`, but always proxies through `/v1/art`, even for saavncdn.com sources — the one thing
 * the proxy exists to guarantee is a CORS-readable response, and JioSaavn's own CDN sends no CORS
 * headers (see naad/routes/v1/art/index.js). Use this, not `artUrl`, wherever the image will be read
 * off a canvas (ambient color extraction) rather than just displayed.
 */
export function corsArtUrl(src?: string | null, size?: number): string | undefined {
  if (!src) return undefined;
  if (src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }
  const upgradedSrc = upgradeImageUrl(src, size ? Math.max(size, 400) : 600) ?? src;
  const params = new URLSearchParams();
  params.set('src', upgradedSrc);
  if (size && size > 0) {
    const renderSize = Math.max(Math.round(size * 1.5), 160);
    params.set('size', String(renderSize));
  }
  return `/v1/art?${params.toString()}`;
}
```

- [ ] **Step 4: Run the test again to confirm it passes**

Run: `npx vitest run src/lib/art.test.ts`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Point `ambient.ts` at `corsArtUrl` instead of `artUrl`**

Change the import line:
```typescript
import { artUrl } from '$lib/art';
```
to:
```typescript
import { corsArtUrl } from '$lib/art';
```
and change:
```typescript
    // Load via the artwork proxy at 64px for fast, CORS-enabled reading
    img.src = artUrl(src, 64) ?? src;
```
to:
```typescript
    // Load via the artwork proxy at 64px for fast, CORS-enabled reading
    img.src = corsArtUrl(src, 64) ?? src;
```

- [ ] **Step 6: Run the ambient-color tests**

Run: `npx vitest run src/lib/color/ambient.test.ts src/lib/art.test.ts`
Expected: PASS, all tests green (`ambient.test.ts`'s existing tests exercise `extractPaletteFromPixels`
directly and don't touch `img.src`, so they're unaffected by this change).

- [ ] **Step 7: Commit**

```bash
git add src/lib/art.ts src/lib/art.test.ts src/lib/color/ambient.ts
git commit -m "fix(art): stop bypassing the CORS proxy for canvas-based ambient color reads

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Clean up the Album page and TrackRow's version-tag display

**Files:**
- Modify: `src/routes/album/[id]/+page.svelte`
- Modify: `src/lib/ui/TrackRow.svelte`

**Interfaces:**
- Consumes: the new `Track`/`Album` types from Task 1 (no `upc`, `isrc`, `discNumber`, `versionTags`).
- Produces: no change to either component's public props.

- [ ] **Step 1: Remove the UPC row from the album header metadata line**

In `src/routes/album/[id]/+page.svelte`, delete:
```svelte
          {#if album.upc}
            <span class="text-ink-faint">·</span>
            <span class="font-mono text-2xs text-ink-faint">UPC {album.upc}</span>
          {/if}
```

- [ ] **Step 2: Remove the disc-grouping logic and always render a flat tracklist**

Delete the two `$derived` declarations:
```svelte
// Disc grouping logic: checks if any track belongs to Disc > 1
const hasMultipleDiscs = $derived((albumQuery.data?.tracks ?? []).some((t) => (t.discNumber ?? 1) > 1));

const discGroups = $derived.by(() => {
  const tracks = albumQuery.data?.tracks ?? [];
  const map = new Map<number, Track[]>();
  for (const t of tracks) {
    const disc = t.discNumber ?? 1;
    if (!map.has(disc)) map.set(disc, []);
    map.get(disc)!.push(t);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b);
});

```
Remove the now-unused `import type { Track } from '$lib/types';` line and the now-unused
`import Disc from 'phosphor-svelte/lib/Disc';` line.

Replace the whole "3. Tracklist (TrackTable with disc grouping)" block:
```svelte
    <!-- 3. Tracklist (TrackTable with disc grouping) -->
    <div class="flex flex-col gap-6">
      {#if hasMultipleDiscs}
        {#each discGroups as [discNum, discTracks] (discNum)}
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2 px-2 py-2 border-b border-border text-xs text-ink-faint font-mono uppercase tracking-wider">
              <Disc size={16} weight="light" />
              <span>Disc {discNum}</span>
            </div>
            <TrackTable
              tracks={discTracks}
              showArtwork={false}
              showAlbum={false}
              {likedIds}
              currentId={player.currentTrack?.id}
              playing={player.status === 'playing'}
              onplay={(t) => player.playTrack(t, album.tracks)}
              onlike={(t) => toggleLikeTrack(t, likedIds.has(t.id))}
            />
          </div>
        {/each}
      {:else}
        <TrackTable
          tracks={album.tracks}
          showArtwork={false}
          showAlbum={false}
          {likedIds}
          currentId={player.currentTrack?.id}
          playing={player.status === 'playing'}
          onplay={(t) => player.playTrack(t, album.tracks)}
          onlike={(t) => toggleLikeTrack(t, likedIds.has(t.id))}
        />
      {/if}
    </div>
```
with:
```svelte
    <!-- 3. Tracklist -->
    <TrackTable
      tracks={album.tracks}
      showArtwork={false}
      showAlbum={false}
      {likedIds}
      currentId={player.currentTrack?.id}
      playing={player.status === 'playing'}
      onplay={(t) => player.playTrack(t, album.tracks)}
      onlike={(t) => toggleLikeTrack(t, likedIds.has(t.id))}
    />
```
(naad never sends `discNumber`, so `hasMultipleDiscs` was always `false` and this branch was
unreachable dead code — every album already rendered through the `{:else}` path.)

- [ ] **Step 3: Remove the UPC row and the per-track ISRC registry from the details section**

Delete:
```svelte
        <div>
          <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint block">Universal Product Code</span>
          <span class="font-mono text-ink mt-1 block" data-numeric>{album.upc ?? '—'}</span>
        </div>
```
(leaving the `grid-cols-1 sm:grid-cols-2 md:grid-cols-4` grid with its remaining three cells — Release
Date, Record Label, Total Duration — and adjusting the grid to `md:grid-cols-3` since there are now
three cells, not four: change `class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs"` to
`class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs"`).

Delete the entire "Per-track ISRC Registry" block:
```svelte
      <!-- Per-track ISRC Registry -->
      <div class="border-t border-border pt-4">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint block mb-3">
          Per-Track International Standard Recording Codes (ISRC)
        </span>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {#each album.tracks as track, i (track.id)}
            <div class="flex items-center justify-between p-2 rounded-xs bg-surface-2/60 text-xs">
              <div class="flex items-center gap-2 min-w-0 flex-1 pr-2">
                <span class="font-mono text-2xs text-ink-faint w-4 text-right" data-numeric>{i + 1}</span>
                <span class="truncate text-ink">{track.title}</span>
              </div>
              <span class="font-mono text-2xs text-ink-muted shrink-0" data-numeric>
                {track.isrc ?? 'NO ISRC'}
              </span>
            </div>
          {/each}
        </div>
      </div>
```
(this was rendering the literal string "NO ISRC" on every track of every album, permanently — naad
never sends ISRC data, so this was a visible defect, not just dead code.)

- [ ] **Step 4: Remove the version-tag badges from `TrackRow.svelte`**

Change:
```svelte
      <p class="truncate font-medium leading-snug" class:text-accent={status !== 'idle'}>
        {track.title}
        {#if track.versionTags.includes('remix')}<span class="text-ink-faint font-normal"> · Remix</span>{/if}
        {#if track.versionTags.includes('live')}<span class="text-ink-faint font-normal"> · Live</span>{/if}
      </p>
```
to:
```svelte
      <p class="truncate font-medium leading-snug" class:text-accent={status !== 'idle'}>
        {track.title}
      </p>
```
(naad never sends `versionTags` — `fillDefaults` in the now-deleted `compat.ts` always set it to `[]`,
so `.includes(...)` was always `false` and neither span has ever rendered.)

- [ ] **Step 5: Check the album route and TrackRow for type errors**

Run: `npx tsc --noEmit --project . 2>&1 | grep -E "album/\[id\]|TrackRow"`
Expected: no output (no errors remaining in either file — `fixtures.ts` isn't touched by this task, but
neither file reads from fixtures directly, so this check is meaningful on its own before Task 7 lands).

- [ ] **Step 6: Commit**

```bash
git add src/routes/album/\[id\]/+page.svelte src/lib/ui/TrackRow.svelte
git commit -m "refactor(album): drop UPC/ISRC/disc-grouping display naad never populates

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Update `/kit` fixtures to naad's real flat shapes

**Files:**
- Modify: `src/lib/fixtures.ts`

**Interfaces:**
- Consumes: the new `Track`/`Album`/`Artist`/`Playlist`/`Audio` types from Task 1.
- Produces: `artists`, `albums`, `tracks`, `playlists` exports keep their names; the old `sources` export
  is dropped (nothing outside `/kit` ever imported it, and Task 3 already rewrote `/kit`'s quality-badge
  section to use inline literals instead).

- [ ] **Step 1: Rewrite `fixtures.ts`**

```typescript
/**
 * Design-kit fixtures: real-shaped data (including long Devanagari titles) so the design system
 * is never reviewed against lorem ipsum. Backs `/kit` only — real screens use live engine data.
 */
import type { Album, Artist, Playlist, Track } from './types';

const img = (seed: string, size = 500): { url: string } => ({
  url: `https://picsum.photos/seed/${seed}/${size}`,
});

export const artists: Artist[] = [
  { id: 'art_weeknd', name: 'The Weeknd', images: [img('weeknd')] },
  { id: 'art_arijit', name: 'Arijit Singh', images: [img('arijit')] },
  { id: 'art_pritam', name: 'Pritam', images: [img('pritam')] },
  { id: 'art_amitabh', name: 'Amitabh Bhattacharya', images: [img('amitabh')] },
];

export const albums: Album[] = [
  {
    id: 'alb_01m34h8ahbb1vrn8v3nw2k0p2n',
    title: 'The Highlights',
    albumType: 'album',
    releaseDate: '2021-02-05',
    label: 'Republic Records',
    trackCount: 14,
    explicit: false,
    artists: [artists[0]!],
    images: [{ url: 'https://c.saavncdn.com/396/The-Highlights-English-2021-20240207045714-500x500.jpg' }],
  },
  {
    id: 'alb_01m34h87p5bh35km3rvpvt7r7y',
    title: 'Brahmastra',
    albumType: 'album',
    releaseDate: '2022-07-06',
    label: 'Sony Music Entertainment India',
    trackCount: 9,
    explicit: false,
    artists: [artists[2]!, artists[1]!],
    images: [
      {
        url: 'https://c.saavncdn.com/871/Brahmastra-Original-Motion-Picture-Soundtrack-Hindi-2022-20221006155213-500x500.jpg',
      },
    ],
  },
];

export const tracks: Track[] = [
  {
    id: '38845390',
    title: 'Blinding Lights',
    artists: [artists[0]!],
    album: { id: albums[0]!.id, title: albums[0]!.title, images: albums[0]!.images },
    durationMs: 200040,
    explicit: false,
    trackNumber: 9,
    images: [{ url: 'https://c.saavncdn.com/396/The-Highlights-English-2021-20240207045714-500x500.jpg' }],
    url: null,
  },
  {
    id: '456323',
    title: 'केसरिया',
    artists: [artists[2]!, artists[1]!, artists[3]!],
    album: { id: albums[1]!.id, title: albums[1]!.title, images: albums[1]!.images },
    durationMs: 268164,
    explicit: false,
    trackNumber: 3,
    images: [
      {
        url: 'https://c.saavncdn.com/871/Brahmastra-Original-Motion-Picture-Soundtrack-Hindi-2022-20221006155213-500x500.jpg',
      },
    ],
    url: null,
  },
  {
    id: 'trk_tumhiho',
    title: 'Tum Hi Ho',
    artists: [artists[1]!],
    album: null,
    durationMs: 262000,
    explicit: false,
    trackNumber: null,
    images: [img('tumhiho')],
    url: null,
  },
  {
    id: 'trk_longtitle',
    title:
      'A Very Long Track Title That Keeps Going And Going To See How The Layout Truncates Gracefully On Small Screens',
    artists: [artists[0]!, artists[2]!],
    album: null,
    durationMs: 312000,
    explicit: true,
    trackNumber: null,
    images: [],
    url: null,
  },
  {
    id: 'trk_noartwork',
    title: 'Not Yet Resolved',
    artists: [artists[3]!],
    album: null,
    durationMs: null,
    explicit: false,
    trackNumber: null,
    images: [],
    url: null,
  },
];

export const playlists: Playlist[] = [
  {
    id: 'pl_superhits',
    title: 'Hindi: India Superhits Top 50',
    description: 'By JioSaavn',
    origin: 'external',
    inLibrary: true,
    images: [img('superhits')],
    trackCount: 50,
  },
  {
    id: 'pl_roadtrip',
    title: 'Road Trip',
    description: null,
    origin: 'user',
    inLibrary: true,
    images: [],
    trackCount: 23,
  },
];
```

(The two `Blinding Lights`/`केसरिया` ids are switched to real JioSaavn ids matching `HANDOFF.md`'s note
that e2e tests now use real ids (`38845390`, `456323`) rather than the old `trk_…` synthetic ones, so
`/kit` stays consistent with what a real engine would actually return for those titles.)

- [ ] **Step 2: Confirm `/kit` and everything importing fixtures still type-checks**

Run: `npx tsc --noEmit --project . 2>&1 | grep -iE "fixtures|routes/kit"`
Expected: no output.

- [ ] **Step 3: Run the full unit test suite**

Run: `npx vitest run`
Expected: PASS, every test file green (this is the first point in the plan where the whole suite,
including files that import fixtures, is exercised together).

- [ ] **Step 4: Commit**

```bash
git add src/lib/fixtures.ts
git commit -m "refactor(fixtures): update /kit fixtures to naad's real flat shapes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Fix the playlist page for naad's real Playlist shape

**Discovered during execution (not in the original plan):** a live `tsc --noEmit` run after Task 1
landed showed `src/routes/playlist/[id]/+page.svelte` still reads the old compat-synthesized
`playlist.items.items` / `.items.next` page wrapper, and compares `playlistQuery.data?.origin` against
`'import'` — a value that was never real (naad only ever reports `'user'` or `'external'`; the import
feature was removed and never built in naad per `HANDOFF.md`) and isn't part of Task 1's `origin` union.
No task in the original plan touched this file. Ruling: add this task rather than leave the playlist
page broken — it's a straightforward consequence of Task 1's real `Playlist` shape, not a design
question.

**Files:**
- Modify: `src/routes/playlist/[id]/+page.svelte`

**Interfaces:**
- Consumes: `Playlist` from Task 1 — `tracks?: Track[]`, `entries?: {itemId: string; addedAt: string}[]`
  (present together only for the user's own playlist; absent together for an external JioSaavn one),
  `origin?: 'user' | 'external'`.
- Produces: no change to the route's own exports (it's a page, not a module other code imports).

- [ ] **Step 1: Fix how local `items` state is built from the query**

Change:
```svelte
// Sync local items with query data
$effect(() => {
  if (playlistQuery.data?.items?.items) {
    items = [...playlistQuery.data.items.items];
  }
});
```
to:
```svelte
// Sync local items with query data: naad returns parallel `tracks`/`entries` arrays for the user's
// own playlist (same order, same length), and only `tracks` for an external (JioSaavn) one.
$effect(() => {
  const tracks = playlistQuery.data?.tracks;
  const entries = playlistQuery.data?.entries;
  if (tracks) {
    items = tracks.map((track, i) => ({
      itemId: entries?.[i]?.itemId ?? `${playlistId}:${i}`,
      addedAt: entries?.[i]?.addedAt ?? new Date(0).toISOString(),
      track,
    }));
  }
});
```
(the synthetic `itemId` fallback only ever applies to a read-only external playlist, since
`isEditablePlaylist` below gates every action that uses `itemId` for a real mutation — it's a Svelte
`{#each ... (item.itemId)}` key, not sent to the server for those playlists. **This `if (tracks)` guard
must NOT become `if (tracks && entries)`** — naad only ever sends `entries` alongside `tracks` for the
user's own playlist; an external playlist has `tracks` with no `entries` at all, and requiring both
would leave every external playlist's track list permanently empty.)

- [ ] **Step 2: Remove the impossible `'import'` origin branch from `isEditablePlaylist`**

Change:
```svelte
const isEditablePlaylist = $derived(
  playlistQuery.data?.origin === 'user' || playlistQuery.data?.origin === 'import',
);
```
to:
```svelte
const isEditablePlaylist = $derived(playlistQuery.data?.origin === 'user');
```

- [ ] **Step 3: Fix the origin label to only ever show a real value**

Change:
```svelte
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint">
          Playlist · {pl.origin === 'user' ? 'Library' : pl.origin === 'import' ? 'Imported' : pl.origin}
        </span>
```
to:
```svelte
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint">
          Playlist · {pl.origin === 'user' ? 'Library' : 'JioSaavn'}
        </span>
```

- [ ] **Step 4: Remove the stale "Quality" column header**

The track-row grid (`style="grid-template-columns: 24px 28px minmax(0, 1fr) auto 20px 48px auto"`,
around line 373) renders 6 real cells — drag handle, index/play, artwork+title, liked-heart, duration,
actions — across those 7 template slots (the 20px slot has no dedicated child; auto-placement quietly
absorbs it). The column header above it (line 344) still labels one slot "Quality" with its own 150px
width, left over from before commit `eb0472c` removed the per-row quality badge this row used to render.
Since both blocks are already being edited in this task and the fix is a mechanical column-count match,
not a design change, align the header to the body's real template exactly:

Change:
```svelte
        <div
          class="grid items-center gap-3 px-2 pb-2 text-2xs uppercase tracking-wide text-ink-faint border-b border-border max-sm:hidden"
          style="grid-template-columns: 28px 28px minmax(0, 1fr) 150px 20px 48px 48px"
        >
          <span></span>
          <span class="text-right" data-numeric>#</span>
          <span>Title</span>
          <span>Quality</span>
          <span></span>
          <span class="text-right">Time</span>
          <span class="text-right">Actions</span>
        </div>
```
to:
```svelte
        <div
          class="grid items-center gap-3 px-2 pb-2 text-2xs uppercase tracking-wide text-ink-faint border-b border-border max-sm:hidden"
          style="grid-template-columns: 24px 28px minmax(0, 1fr) auto 20px 48px auto"
        >
          <span></span>
          <span class="text-right" data-numeric>#</span>
          <span>Title</span>
          <span></span>
          <span></span>
          <span class="text-right">Time</span>
          <span class="text-right">Actions</span>
        </div>
```

- [ ] **Step 5: Check this file for type errors**

Run: `npx tsc --noEmit --project . 2>&1 | grep "routes\\\\playlist"`
Expected: no output.

- [ ] **Step 6: Run the full unit test suite**

Run: `npx vitest run`
Expected: PASS (this file has no dedicated unit test — it's exercised by `test:e2e` against a live
engine, out of scope for this plan per Global Constraints — but this confirms the change didn't break
any other test).

- [ ] **Step 7: Commit**

```bash
git add src/routes/playlist/\[id\]/+page.svelte
git commit -m "fix(playlist): read naad's real tracks/entries shape, drop the dead import origin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Final verification sweep

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Full type check**

Run: `npm run check`
Expected: 0 errors. If any remain, they name the file — go back to the task that was supposed to own
that file and finish it before proceeding.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Full unit test suite**

Run: `npm run test`
Expected: PASS, every test file green.

- [ ] **Step 4: Grep sweep for anything left behind**

Run:
```bash
grep -rn "selectedSource\|alternatives\|\.tier\b\|versionTags\|discNumber\|\bupc\b\|\.isrc\b\|resolveSources\|ResolvedSources\|calculateEffectiveVolume\|isTokenExpiringSoon\|checkProactiveExpiry" src/ || echo "clean"
```
Expected: `clean` (no matches). If anything matches, it's a file this plan missed — fix it before
declaring the refactor done.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: builds successfully with no errors.

- [ ] **Step 6: Note what's still manual**

Per `HANDOFF.md`'s own testing rules, this plan does not run `npm run test:e2e` (it needs a live `naad`
instance) or take screenshots. Before calling the refactor fully verified in the field, run
`npm run test:e2e` against a running `naad` and spot-check the Now Playing Signal path tab, the Album
page, and a track row with a long title, in both themes, per the screenshot review protocol in
`HANDOFF.md` section 8.4.

- [ ] **Step 7: Final commit (if step 6 turned up fixes)**

```bash
git add -A
git commit -m "chore: final verification pass for the JioSaavn-only refactor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
