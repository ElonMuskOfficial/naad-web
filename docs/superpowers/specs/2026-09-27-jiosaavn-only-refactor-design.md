# NAAD Web: JioSaavn-only refactor

**Date:** 2026-09-27
**Status:** Approved (delegated to engineering judgment by the user)

## Context

`naad-web` was designed and partly built against `naad-v3`, a multi-provider engine (JioSaavn plus
hi-res/lossless sources, YouTube "materialize" delivery, signed play tokens, loudness normalization,
imports from Spotify/Apple/YouTube). The app now runs against `naad`, a much smaller, JioSaavn-only
proxy (see `naad/README.md`). `naad-web/HANDOFF.md` documents the switch and the shim that was added to
keep the multi-provider-shaped frontend working against the new engine (`src/lib/api/compat.ts`).

That shim, plus the still-multi-provider-shaped types (`src/lib/api/schema.d.ts`, hand-kept since
`naad` has no OpenAPI document to regenerate from) and several UI surfaces built for capabilities naad
doesn't have, are now permanent dead weight: fields that are always null, states that can never occur,
and a translation layer bridging a shape gap that no longer needs bridging. This refactor removes all of
it and rebuilds the affected surface directly around naad's real, single-provider shapes.

This was reached through the `superpowers:brainstorming` process. The three central decisions were
confirmed explicitly by the user:

1. Simplify the Signal Path / quality UI to only what's real for a single JioSaavn stream (no delivery
   protocol, no alternatives list, no catalog-provider row, no hi-res/lossless tiers).
2. Replace `schema.d.ts` with a small hand-written type file matching naad's actual JSON shapes, and
   delete `compat.ts` entirely.
3. Remove the dead loudness-normalization (`gainDb`) plumbing from the player, keeping crossfade.

The user then delegated the remaining scope call (whether to bundle three previously-diagnosed
correctness bugs into this same pass) to engineering judgment. Decision: **bundle them** — two of the
three touch files this refactor already opens (`src/lib/art.ts`, and indirectly the Signal Path
surface), and all three are already fully diagnosed with a known fix. Doing them separately would mean
opening the same files twice for no benefit.

## Goals

- Delete every type, field, and code path that exists only to model capabilities naad does not have
  (multiple providers, delivery modes, hi-res/lossless tiers, signed/expiring play links, loudness
  normalization, alternates/fallback sources, ISRC/UPC metadata).
- Delete the `compat.ts` adapter layer by making the real types match the real responses, so there is
  nothing left to adapt.
- Fix the three correctness bugs already found in the prior review, bundled into the files this
  refactor touches anyway.
- Leave behavior that has nothing to do with multi-source (search, library, radio, history, crossfade)
  untouched.

## Non-goals

- No bundle-size / performance pass (lazy loading, dependency audit, Lighthouse budget). This is a
  correctness/maintainability cleanup, not a perf project.
- No changes to `naad` (the backend). Everything here is frontend-only.
- No new features. Anything that reads as a capability change (e.g. changing what the quality badge
  shows) is a simplification to match what naad can actually provide, not new functionality.

## 1. New type model

Replace `src/lib/api/schema.d.ts` (1967 lines, generated years ago against `naad-v3`'s OpenAPI document,
now hand-maintained and describing routes/fields `naad` doesn't have) with a small, hand-written
`paths`/`components["schemas"]` file sized to what `openapi-fetch`'s `createClient<paths>` expects,
modeling exactly naad's real responses (verified directly against `naad/lib/jiosaavn/map.js`,
`naad/lib/jiosaavn/catalog.js`, `naad/lib/jiosaavn/home.js`, and every route file under `naad/routes/v1`).

**`Track`** (`trackView` in `naad/lib/jiosaavn/map.js`):
```ts
interface Track {
  id: string;
  title: string;
  artists: { id: string; name: string }[];
  album: { id: string; title: string; images: Image[] } | null;
  durationMs: number | null;
  explicit: boolean;
  trackNumber: number | null; // always null from naad today; kept because map.js emits it
  images: Image[];
  url: string | null; // JioSaavn's own perma_url
}
```
Dropped: `isrc`, `versionTags`, `discNumber`, `quality`, `liked`, `links`. None of these are ever sent by
naad. Confirmed by grep: nothing in the app reads `.liked` or `.links` except the stale type file itself
(liked status is always fetched separately via the batched `/v1/library/tracks/contains` call, which is
correct and unaffected).

**`Album`** (`albumView`):
```ts
interface Album {
  id: string;
  title: string;
  albumType: 'single' | 'album';
  releaseDate: string | null;
  label: string | null;
  trackCount: number;
  explicit: boolean;
  artists: { id: string; name: string }[];
  images: Image[];
  tracks: Track[]; // only on GET /v1/albums/{id} (catalog.js: `{ ...album, tracks }`)
}
```
Dropped: `upc` (naad never sends it; currently rendered as a permanently-empty "—" row).

**`Artist`** (`artistView` + `getArtist`):
```ts
interface Artist {
  id: string;
  name: string;
  images: Image[];
  topTracks: Track[]; // only on GET /v1/artists/{id}
  albums: Album[];
  singles: Album[];
  related: Artist[];
}
```

**`Playlist`** (`playlistView` + `getPlaylist` + the library route's own-playlist branch):
```ts
interface Playlist {
  id: string;
  title: string;
  description: string | null;
  trackCount: number;
  images: Image[];
  // only on GET /v1/playlists/{id}:
  tracks?: Track[];
  entries?: { itemId: string; addedAt: string }[]; // only for the user's own (`usr_…`) playlists
  origin?: 'user' | 'external';
  inLibrary?: boolean;
}
```
Dropped: the synthesized `items: { items, next }` page wrapper `compat.ts` built
(`withPlaylistItems`) — naad has no cursor pagination on playlists (`?limit=` only, max 200), so there
never was a real `next` to expose. Call sites read `tracks`/`entries` directly.

**`Audio`** (replaces `Source`; the real shape of `GET /v1/tracks/{id}/audio`):
```ts
interface Audio {
  url: string;
  bitrateKbps: number;
  codec: string;
  mimeType: string;
  durationMs: number | null;
}
```
Dropped entirely: `Source`, `SourceInput`, `TrackQuality`, `TrackQualityInput`, and every field that
only made sense across multiple providers (`tier`, `bitDepth`, `sampleRate`, `delivery`, `normalization`,
`provider`, `matchScore`, `verifiedAt`, `alternatives`).

**Home section** (`sectionsFromLaunchData` in `home.js`):
```ts
interface Section {
  id: string;
  title: string;
  subtitle?: string;
  kind: 'tracks' | 'albums' | 'playlists' | 'artists';
  items: Track[] | Album[] | Playlist[] | Artist[];
}
```

**Radio** (`Discovery.radio`): `{ seed: string; tracks: Track[] }`.

**Error shape**: naad is plain Fastify, always `{ statusCode: number; error: string; message: string }`
(`@fastify/sensible`'s `httpErrors`). No RFC 7807 problem+json anywhere in naad. `ApiError` construction
in `client.ts` collapses to this one shape.

**Dropped paths** (never implemented in naad, never called by naad-web — confirmed by grep for
`/import`, `/mixes`, `/resolve`, `/queue` across `src/`, which only matched the stale
`schema.d.ts`): `/v1/imports`, `/v1/resolve`, `/v1/stream/*`, `/v1/mixes`, `/v1/charts`,
`/v1/new-releases`, `/v1/queue/*`, `/v1/tracks/{id}/play`.

`src/lib/types.ts` keeps re-exporting from the new file under the same names (`Track`, `Album`,
`Artist`, `Playlist`, `Problem`), so most component-level `import type { Track } from '$lib/types'`
statements are untouched. `Source` is replaced by `Audio` everywhere it's imported.

## 2. API / compat layer

- **Delete `src/lib/api/compat.ts` and `src/lib/api/compat.test.ts` outright.** With real types matching
  real responses there is no shape gap left to bridge — no URL rewriting, no response reshaping, no
  `fillDefaults` heuristics.
- `src/lib/api/client.ts`:
  - Remove the `schemaPath === '/v1/tracks/{id}/sources'` rewrite branch in `onRequest`.
  - Remove the `adaptResponse` call in `onResponse`; naad's JSON responses pass through unmodified.
  - Collapse `toProblem`'s two branches into one: naad's `{statusCode, error, message}` is the only
    shape `ApiError` needs to parse.
  - Keep: auth-header injection, the 401 → `/settings` redirect, `getStoredApiKey`/`getStoredEngineUrl`
    and their setters (all real, still-used features).
- Call sites that hit `/v1/tracks/{id}/sources` — `engine.svelte.ts` (4 call sites) and `scheduler.ts` (2
  call sites) — are rewritten to call `/v1/tracks/{id}/audio` directly and consume the flat `Audio`
  shape (`{url, bitrateKbps, codec, mimeType, durationMs}`) instead of `{selected, alternatives, play}`.
- Playlist call sites (`playlist/[id]/+page.svelte` and any query in `queries/index.ts`) read
  `playlist.tracks` / `playlist.entries` directly instead of `.items.items` / `.items.next`.

## 3. Player engine

- `src/lib/player/engine.svelte.ts`:
  - Replace `selectedSource` / `alternatives` state with a single `currentAudio: Audio | null`.
  - Remove the alternatives-fallback retry path (naad returns none; the only recovery on playback
    failure is re-calling `/audio?refresh=true`).
  - Remove `track.quality` from the per-row model. The quality badge becomes a property of the
    *currently playing* track only, derived directly from `currentAudio` (this matches the existing,
    already-documented behavior in `HANDOFF.md`: "Quality badge only for the playing song" — no change
    in visible behavior, just removal of the now-pointless `quality: null` field threaded through every
    list response).
  - Remove the proactive expiry-refresh timer. It existed to refresh a link before `compat.ts`'s
    fabricated 30-day `expiresAt` lapsed; naad's `/audio` links aren't signed or short-lived (cached 24h
    server-side, but the CDN URL itself doesn't expire on a client-visible schedule), so there is nothing
    to proactively refresh. Keep the reactive path: on the `<audio>` element's `error` event, re-call
    `/audio?refresh=true`, restore position, resume.
- `src/lib/player/scheduler.ts`: same rewrite for prefetch/preload resolution.
- `src/lib/player/audio-graph.ts` + `src/lib/player/math.ts`: remove the `gainDb` parameter from
  `calculateEffectiveVolume` and every caller; volume becomes just the clamped user volume. Crossfade
  (`startCrossfade`, the RAF-based volume ramp) is untouched — it's a real, working, non-multi-source
  feature.
- Update `engine.test.ts`, `scheduler.test.ts`, `math.test.ts` for the new shapes and the removed gain
  parameter.

## 4. UI

- `src/lib/ui/SignalPathCard.svelte`: remove the Delivery Protocol row, the Alternatives list section
  (always empty — naad never returns alternates), the Catalog Provider row (always the literal string
  `"jiosaavn"`), and the Normalization Calibration row (always "None"). Keep: codec, container/mimetype,
  bitrate. Props shrink from `{selectedSource, alternatives}` to `{audio: Audio | null}`.
- `src/lib/ui/QualityBadge.svelte` + `format.ts`'s `describeQuality()`: remove the hi-res/lossless/
  bitDepth/sampleRate branches (JioSaavn's ceiling is AAC 320kbps; these branches can never execute).
  The badge always renders `"{CODEC} {bitrateKbps}"` (e.g. `AAC 320`). Remove the tier-based accent
  color switch (nothing left to distinguish — one real tier).
- `src/routes/album/[id]/+page.svelte`:
  - Remove the UPC row (`album.upc`, always null → always rendered as `—`).
  - Remove the per-track ISRC display (`track.isrc ?? 'NO ISRC'`) — this currently renders the literal
    string "NO ISRC" on every single track row for every album, permanently, since naad never sends
    ISRC. This is a user-visible defect, not just dead code, and is fixed by removing the column instead
    of masking it.
  - Remove the disc-number grouping branch (`hasMultipleDiscs`, keyed off `t.discNumber ?? 1`) — naad
    never sends `discNumber`, so this can never be `true`; the grouping code is unreachable.
- `src/lib/fixtures.ts` (backs the `/kit` design-regression route): update every fixture to the new flat
  `Track`/`Album`/`Audio` shapes so `/kit` keeps compiling and stays representative.

## 5. Bundled correctness fixes

These were diagnosed in the prior backend-usage review. Bundled here because they touch files this
refactor already opens, and because the underlying cause is the same "modeled for a bigger system than
we have" root: existing helpers are trying to serve two eras of the app at once.

1. **Ambient artwork colour is dead for the whole catalog.** `src/lib/art.ts`'s `artUrl()` returns raw
   `saavncdn.com` URLs unproxied, skipping `/v1/art`. Since naad's `/v1/art` proxy exists specifically
   because "the CDN sends no CORS headers" (`naad/routes/v1/art/index.js`), and `ambient.ts` loads
   artwork with `img.crossOrigin = 'anonymous'`, every real ambient-color extraction silently fails and
   falls back to the default palette. **Fix:** `artUrl()` always proxies through `/v1/art` when a size is
   given for canvas reading; plain `<img>` display call sites that don't need CORS keep the direct-CDN
   fast path by not requesting the proxy (i.e. split the "give me a display URL" and "give me a
   CORS-safe URL for canvas reads" concerns instead of collapsing them into one function that guesses).
2. **History flush bypasses the configured Engine URL.** `src/lib/player/history.ts`'s `flush()` does a
   raw `fetch('/v1/history', …)` with a hardcoded relative path instead of going through the shared `api`
   client. **Fix:** route the flush through `api.POST('/v1/history', …)` (or at minimum resolve against
   the same stored engine URL `client.ts` uses) so history is recorded correctly when a non-default
   Engine URL is configured in Settings.
3. **Search "Load more" can send an offset naad rejects.** `naad/lib/jiosaavn/catalog.js`'s
   `nextOffset: more ? offset + limit : null` is uncapped, but the route schema caps `offset` at
   `maximum: 200`. This is a **backend** fix (not frontend), out of place in a frontend refactor spec,
   but listed here for completeness since it was found in the same review. **Fix, on the naad side:**
   cap `nextOffset` at the route's own maximum (or the route validates and clamps incoming `offset`
   instead of 400ing). Flagged for the user to decide whether to fix in `naad` now or file separately —
   **not part of this frontend implementation plan.**

## 6. Explicitly out of scope

Crossfade, search paging (aside from item 3 above, deferred to the backend), library CRUD, radio, home
feed rendering, history batching logic (aside from item 2 above), settings, theming, and design-system
components are untouched — none of them are multi-source-specific.

## 7. Verification

- Every touched `*.test.ts` file is updated in the same step as its source (TDD-style: adjust the test
  first where the shape change is mechanical, run it red, then change the source).
- End of plan: `npm run check`, `npm run lint`, `npm run test` all clean.
- No naad-side contract changes in this plan (item 3 above is explicitly deferred), so no live-engine
  behavior shifts; `npm run test:e2e` assumptions are unaffected structurally, though it should still be
  re-run against a live `naad` before calling this done, per `HANDOFF.md`'s own testing rules.

## File-level change list

| File | Change |
|---|---|
| `src/lib/api/schema.d.ts` | Replaced with a small hand-written `paths`/`components` file |
| `src/lib/types.ts` | Re-export names unchanged; `Source` → `Audio` |
| `src/lib/api/compat.ts`, `compat.test.ts` | Deleted |
| `src/lib/api/client.ts`, `client.test.ts` | Remove rewrite/adapt middleware; collapse error parsing |
| `src/lib/player/engine.svelte.ts`, `engine.test.ts` | `/audio` directly; drop alternatives, expiry timer, `quality` |
| `src/lib/player/scheduler.ts`, `scheduler.test.ts` | `/audio` directly |
| `src/lib/player/audio-graph.ts` | Drop `gainDb` |
| `src/lib/player/math.ts`, `math.test.ts` | Drop `gainDb` param |
| `src/lib/player/history.ts` | Route flush through the shared `api` client (bug fix) |
| `src/lib/art.ts` | Split display-URL vs. CORS-proxied-URL concerns (bug fix) |
| `src/lib/ui/SignalPathCard.svelte` | Drop delivery/alternatives/provider/normalization rows |
| `src/lib/ui/QualityBadge.svelte` | Drop hi-res/lossless branches |
| `src/lib/format.ts`, `format.test.ts` | Simplify `describeQuality` |
| `src/routes/album/[id]/+page.svelte` | Drop UPC row, ISRC column, disc grouping |
| `src/lib/fixtures.ts` | Update to new flat shapes |
| `naad/lib/jiosaavn/catalog.js` | (deferred, not in this plan) cap `nextOffset` |
