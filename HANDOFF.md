# NAAD Web: Handoff Plan (Phases B–D)

> **UPDATE 2026-09-26: the app now runs on `naad`, not `naad-v3`. Read this box first; sections below that describe
> the old engine (Postgres, `/docs`, `openapi.json`, `/v1/sources`, imports, mixes, `naad-v3` paths) are historical.**
>
> - **Engine:** `D:\Dev\Projects\music\naad` (Node ≥ 22.9, plain JS, Fastify, Redis). Start it with
>   `PORT=8080 REDIS_URL=… LIBRARY_REDIS_URL=… npm run dev`. `LIBRARY_REDIS_URL` is the persistent library (likes, saved
>   albums, followed artists, playlists, history) and must not evict; unset, it shares `REDIS_URL`. See its README.
> - **What `naad` serves:** the JioSaavn catalog (`/v1/home|search|tracks|albums|artists|playlists|radio|art`,
>   `/v1/tracks/{id}/audio|lyrics`) and the library (`/v1/library/*`, user playlists under `/v1/playlists`,
>   `/v1/history`). Errors are Fastify's `{ statusCode, error, message }`.
> - **UPDATE 2026-09-27: the app now matches naad's real shapes directly, no adapter layer.**
>   `src/lib/api/compat.ts` (which used to adapt naad's answers into the old multi-provider shapes the
>   components read) has been deleted. `schema.d.ts` is hand-written to match naad's real JSON exactly —
>   naad has no OpenAPI document to generate it from, so it's maintained by hand against naad's actual
>   source, not kept as a "superset" of anything. `npm run api:gen` has been removed from `package.json`
>   for the same reason. See `docs/superpowers/specs/2026-09-27-jiosaavn-only-refactor-design.md` and its
>   accompanying plan for the full rationale.
> - **No quality tiers:** JioSaavn's best file (`max`, 320 kbps AAC for most songs) is always played, so the Settings
>   tier picker, the stored `naad:quality*` preferences and the engine's `quality` plumbing are gone. The quality badge still
>   shows the codec and bitrate of what is playing.
> - **Quality badge only for the playing song** (player bar, now-playing header, signal-path card). Lists, the
>   History tab, the playlist page, the search top result and the queue panel show none: naad reports a song's bitrate only
>   from its own `/audio` lookup, so a badge on every row would need one request per row for a value that is almost
>   always AAC 320.
> - **No loudness normalization:** naad sends no loudness data, so the toggle and the engine flag were removed
>   (loudness differs by ~4 dB between songs; crossfade stays, and is skipped between tracks of one album by design).
> - **Search "Load more"** on the Tracks/Albums/Artists/Playlists tabs (`src/lib/queries/search.ts`). naad builds its result
>   window from several JioSaavn pages (JioSaavn caps one call at 40 results), so paging goes deep; pages overlap a
>   little because the window is re-ranked, and the app drops repeats by id.
> - **Removed:** the import feature (`/import`, palette entry, sidebar link). Mixes, `/resolve`, `/stream` and playlist
>   duplicate were never built in naad and no screen uses them.
> - **Session data** saved under another engine is wiped once (`src/lib/player/session-version.ts`, `DATA_VERSION`).
>   Bump `DATA_VERSION` whenever saved ids stop being valid.
> - **Fixed on the way:** the `L` shortcut toggles (it only ever liked), follow/unfollow refreshes the followed list,
>   album Save really saves, and skipping to a preloaded next track records the listen (it was silently lost).
> - **e2e** runs against a live engine (Vite proxies `/v1` to `NAAD_ENGINE_URL`, default `http://127.0.0.1:8080`) with
>   real JioSaavn ids (Brahmastra `38845390`, Pritam `456323`), not the old `alb_…`/`art_…` ids.
> - **Not verified by machine:** how playback sounds (gapless, crossfade, loudness). The audio element plays the
>   320 kbps CDN stream and skips/prefetches correctly; judge quality by ear.

This is everything needed to finish the NAAD web frontend: all remaining frontend work (Phases B, C and D), the engine changes the frontend depends on, and how to test every part. It is written for an AI coding agent picking up the work cold. Read sections 0–4 fully before touching code.

- **Frontend:** `D:\Dev\Projects\music\naad-web` (SvelteKit SPA; this repo)
- **Engine:** `D:\Dev\Projects\music\naad-v3` (Node/TS, Fastify, Postgres, Redis; the API this app talks to)
- **Original approved plan:** reproduced in full in **Appendix A**. It is the source of the design intent. Where this document differs from it, this document wins; each difference is listed in Appendix A.1 with the reason.

---

## 0. Rules (read first, non-negotiable)

1. **Do not run `git commit`** in either repo unless the user explicitly asks for a commit in that moment. Earlier permission does not carry forward. Leave work uncommitted and say what changed.
2. **Do not touch `naad-v3`'s uncommitted work.** That repo has ~71 modified or untracked paths, including whole untracked directories (`src/http/`, `src/app/`, `src/modules/playback/`, `docker/`, `README.md`). This is the user's real, unsaved engine. Never run `git reset`, `git checkout -- .`, `git restore`, `git clean`, or `git stash` there. Add new files and make targeted edits only.
3. **Stop at every review gate** (end of each sub-phase marked **GATE**). Show the user the screenshots or results and wait for a go-ahead. Do not roll into the next phase on your own.
4. **Check library docs before using an API.** The user requires fetching current docs (Context7 MCP: `resolve-library-id` then `query-docs`) for any library, framework or CLI question: SvelteKit, Svelte 5, bits-ui, TanStack Query, openapi-fetch, Vitest, Playwright, Tailwind v4, vite-pwa. Several bugs in Phase A came from guessed APIs.
5. **Report honestly.** If you could not verify something (especially audio behaviour, which screenshots cannot show), say so plainly. Never claim "gapless works" from a type check.
6. **Items marked `USER DECISION`** must be asked about before implementing. Give the recommendation, then ask.

---

## 1. Where things stand

### Done: Phase A (design system), reviewed and signed off

- Scaffold: SvelteKit 2 + Svelte 5 runes, SPA mode (`src/routes/+layout.ts`: `ssr = false`), `adapter-static` with `fallback: '200.html'` (configured inside `vite.config.ts`; there is no `svelte.config.js`).
- Design tokens in `src/app.css` (Tailwind v4 `@theme` with `--*: initial` full reset), dark and light themes via `<html data-theme>`, set before first paint by the inline script in `src/app.html`.
- Theme store `src/lib/theme.svelte.ts` (`theme.set()` / `theme.toggle()`; always go through it, never set the attribute directly).
- 17 UI components in `src/lib/ui/` (barrel `index.ts`): Artwork, Button, EmptyState, IconButton, MediaCard, Menu, MenuItem, PlayingIndicator, QualityBadge, Scrubber, Sheet, Shelf, Skeleton, ToastViewport, TrackRow, TrackTable. Toast store: `src/lib/toast.svelte.ts`.
- Custom transport icons in `src/lib/icons/`. Phosphor (light weight) everywhere else.
- `/kit` route (`src/routes/kit/+page.svelte`): every component in every state, driven by `src/lib/fixtures.ts`. **Keep `/kit` and the fixtures.** They are the design regression page, not a data source for real screens. (The original plan called it `/_kit`, but SvelteKit treats `_`-prefixed route folders as private, so it is `/kit`.)
- Hand-written API types in `src/lib/types.ts` (to be replaced by generated ones, see B1).
- Commits in naad-web: `d3e2499` (scaffold), `fe766ce` (Review 1 fixes).
- `npm run check` and `npm run lint` are clean. Keep them that way.

### Not started

Everything in Phases B, C and D below, plus two engine changes (artwork proxy, per-track quality summary) and the Caddy config for serving the app.

---

## 2. Running everything

### Engine (needed for all of Phase B onward)

Requires Node ≥ 24.11, PostgreSQL ≥ 15, Redis or Valkey. Optional: `yt-dlp` and `ffmpeg` (YouTube playback).

```bash
cd D:\Dev\Projects\music\naad-v3
npm ci
# .env already exists. Check it has DATABASE_URL, REDIS_URL, PLAY_TOKEN_SECRET (≥32 chars), PUBLIC_BASE_URL.
npm run db:migrate
npm run dev            # http://localhost:8080 ; API docs at /docs ; spec at /v1/openapi.json
```

- If `NAAD_API_KEY` is set in `.env`, every `/v1/*` call needs `Authorization: Bearer <key>` **except** `/v1/stream/*` and `/v1/openapi.json`. When bound to loopback (the default for local dev) the key is optional.
- The library starts empty. To get real data for screenshots: search via the API, like some tracks, and import a playlist (`POST /v1/imports` with a Spotify/Apple/YouTube playlist URL). Use a mix of Hindi (Bollywood) and Western tracks, because Devanagari rendering is a design requirement.

### Web

```bash
cd D:\Dev\Projects\music\naad-web
npm install
npm run dev            # Vite proxies /v1, /healthz, /docs to NAAD_ENGINE_URL (default http://127.0.0.1:8080)
npm run check          # svelte-check (types + Svelte diagnostics)
npm run lint           # biome
```

There is **no test runner configured yet** in naad-web (Vitest and Playwright are installed but have no config). Creating them is task B0.

---

## 3. Design rules (from the approved "Signal & Sleeve" plan)

A working summary. The full wording is in Appendix A, sections 1 and 2.

**Concept:** a hi-fi component crossed with a record sleeve. Precise technical readouts next to editorial, artwork-led pages. It must **not look AI-generated**.

**Banned → what to do instead**

| Banned | Instead |
| --- | --- |
| Indigo/purple gradients, glows, gradient text | Warm neutral surfaces. Colour comes only from the playing artwork plus one amber accent |
| Glassmorphism, blur everywhere | Solid surfaces. Blur in exactly one place: the Now Playing backdrop |
| One font, centred everything | Fraunces (display titles only), IBM Plex Sans (UI), Plex Sans Devanagari (Hindi), Plex Mono (timecodes, quality). Left-aligned, grid-based |
| `rounded-2xl` cards with shadows | 2–4 px radii, 1 px hairlines, no card shadows. Lists are real aligned tables |
| Emoji, one-weight icon sets | Custom transport icons + Phosphor light |
| Hero banners, "Welcome back!" | No hero. Content starts at the top. Short plain labels ("Jump back in", "Up next") |
| Decorative motion, shimmer | Motion only when it explains something. 120–280 ms, one easing curve, `prefers-reduced-motion` respected. Skeletons do not shimmer |
| Placeholder art, lorem ipsum | Real engine data on every screen from the first build |

**Colour:** amber `--accent` (#FFB547) is reserved for *signal*: hi-res badge, live playing indicator, focus ring, current track. Never decoration, never a generic button fill beyond the existing primary Button. Ambient colour from artwork only tints the Now Playing backdrop and a thin player-bar edge.

**Signature elements** (what makes it NAAD):
1. **Quality readout:** mono small-caps badge (`HI-RES · FLAC 24/96`, `LOSSLESS 16/44.1`, `AAC 320`). Clicking opens the **Signal path** card: provider, codec, bit depth, sample rate, delivery, normalization gain.
2. **Liner-notes pages:** album and artist pages laid out like a record sleeve: large Fraunces title, then release date, label, UPC, per-track ISRC, in the type system.
3. **Lyrics as a stage:** synced lines in large Plex (Devanagari where needed). Active line full contrast, others dimmed. Clicking a line seeks.
4. **Hairline scrubber** with mono timecode. No fake waveform.

**Layout:** desktop shell (sidebar, content, right panel, fixed 72 px player bar). A 12-column grid in the content area, on the 4 px spacing base. Track rows 44 px desktop / 56 px touch, columns #, title/artists, album, quality, time. Square artwork, 3 px radius, a small fixed set of sizes. Tracklists are dense; artwork pages breathe. Breakpoint `sm` = 640 px.

---

## 4. Verified engine facts and known problems

These were checked against the engine source (`naad-v3/src/http/`), not assumed.

### 4.1 Endpoints

| Area | Endpoints |
| --- | --- |
| Catalog | `GET /v1/search`, `GET /v1/tracks/:id` (adds `links`, `liked`), `GET /v1/albums/:id` (Album + `tracks[]`), `GET /v1/artists/:id` (Artist + `topTracks`, `albums`, `singles`, `related`), `GET /v1/playlists/:id` (Playlist + `items: {items: [{itemId, addedAt, track}], next}`; params `limit`, `cursor`) |
| Discovery | `GET /v1/home` → `{sections: Section[]}`, `GET /v1/radio?seed=&limit=&exclude=`, `GET /v1/charts?region=`, `GET /v1/new-releases?region=`, `GET /v1/mixes`, `GET /v1/tracks/:id/lyrics` |
| Playback | `GET /v1/tracks/:id/sources?quality=&refresh=`, `GET /v1/tracks/:id/play` (302 only), `POST /v1/player/prefetch`, `GET|HEAD /v1/stream/:token` (Range supported) |
| Library | `GET/PUT/DELETE /v1/library/tracks`, `GET /v1/library/tracks/contains`, `GET /v1/library/albums`, `PUT/DELETE /v1/library/albums/:id`, same for `artists`, `GET /v1/library/playlists`, `PUT /v1/library/playlists/:id` |
| Playlists | `POST /v1/playlists`, `POST /v1/playlists/:id/duplicate`, `PATCH/DELETE /v1/playlists/:id`, `POST/DELETE /v1/playlists/:id/items`, `POST /v1/playlists/:id/items/:itemId/move` (body `afterItemId`) |
| History | `POST /v1/history`, `GET /v1/history` (paged) |
| Import | `POST /v1/imports`, `GET /v1/imports/:id`, `GET /v1/resolve` |
| Ops | `GET /healthz`, `GET /readyz`, `GET /v1/openapi.json`, `/docs` |

### 4.2 Contract details that matter

- **Use `/v1/tracks/:id/sources` for playback, not `/play`.** Only `/sources` returns `play.url`, `play.expiresAt`, `play.mimeType`, `play.normalization {gainDb, lufs} | null`, plus `selected` and `alternatives` Source objects. `/play` only redirects.
- **`<audio src>` needs no auth header.** Stream URLs carry their own HMAC signature and are exempt from the API key. Point the audio element straight at `play.url`. Do not build a fetch-to-blob workaround.
- **Expired play token → 403** (`forbidden`, detail "Play token expired"). **Source gone → 410** (`gone`). Token TTL defaults to 6 h (`PLAY_TOKEN_TTL_SECONDS`). An `<audio>` element does not expose HTTP status, only a `MediaError`, so recovery must be: on `error` (or proactively when `expiresAt` is within ~2 minutes of a needed load), call `/sources` again (with `refresh=true` after a failure) and resume at the saved position.
- **Rate limits:** `/sources`, `/play` and `/player/prefetch` are "heavy", budget `RATE_LIMIT_RESOLVE_PER_MINUTE` (default **60/min**). Everything else 240/min. Never resolve sources per row in a list.
- `POST /v1/player/prefetch`: `trackIds` 1–**10** per call (chunk the queue), returns 202.
- `GET /v1/radio`: `seed` is prefixed `track:`, `artist:`, `album:` or `playlist:` + id (5–80 chars). `exclude` is comma-separated ids.
- `GET /v1/home`: `Section` is a discriminated union on `kind`: `tracks | albums | artists | playlists`. The Home renderer must handle all four exhaustively.
- `GET /v1/tracks/:id/lyrics`: `{trackId, synced: [{timeMs, text}] | null, plain: string | null, source}`. `synced: null` with `plain` set is normal (needs a designed fallback), and both null is "no lyrics", not an error.
- `POST /v1/history`: `{listens: [{trackId, startedAt, msPlayed, completed?, context?: {type, id}, sourceProvider?}]}`, 1–200 items, `startedAt` must be ISO 8601 **with offset**. The server already ignores plays under 30 s for recommendations. Do not filter client-side.
- `Track.durationMs` is **nullable**. Fixtures always set it, so `formatDurationMs` has never seen `null` in practice. Test it.
- `liked` is only on `GET /v1/tracks/:id`. For lists use `GET /v1/library/tracks/contains` in one batched call per page.
- Errors are RFC 9457 `application/problem+json`: `{type, title, status, detail?, instance?, requestId?, errors?}`.
- **Delivery modes:** `redirect` (302 to a third-party CDN; zero server bandwidth; Monochrome defaults to this), `proxy` (engine streams bytes, same origin), `materialize` (YouTube: downloaded once with yt-dlp, then served from disk; first play can be slow, so show a loading state).

### 4.3 Problem 1: the quality badge had no data (DECIDED: engine adds a per-track `quality` summary)

`src/lib/types.ts` declares `Track.source?: Source`, fixtures fill it, and `TrackRow` renders `QualityBadge` from it. **The engine never sends it.** `TrackSchema` has no source field in any list (album tracks, home sections, playlist items, search). Source data exists only behind `/v1/tracks/:id/sources`, which is rate-limited to 60/min, so resolving per row is out.

**Decision (approved by the user):** the engine adds a nullable `quality` summary to every track it returns, built from the best source it has **already measured and stored** in the `track_sources` table. It is one batched database query per response, with no calls to upstream services, and it fills in as the user plays more. Full engine spec: section 7.2. Frontend work: B1 and B3.

Rejected alternatives, for the record: showing badges only for tracks resolved in the current session (the signature element would mostly vanish from Album and Home), and a single album-level badge (loses per-track detail).

What the frontend must handle:
- **`quality: null` is the common case at first** (a track nobody has played yet). `TrackRow` then leaves the quality cell empty, keeps the grid column so rows stay aligned, and shows no placeholder text.
- **Row badge vs. Signal path.** The row badge means "the best quality NAAD has measured for this track". What actually plays can be lower (the user's quality setting, e.g. cellular `high`, or a fallback to an alternative source). Now Playing's badge and the Signal path card must use the **selected source from `/sources`**, not `track.quality`.
- After a track is played, its row badge updates on the next fetch of that list. No live patching needed; invalidating the queries that hold that track after `/sources` succeeds is enough.

Also: the web `Source` type is missing `durationMs` (the engine has it). The generated types in B1 fix this automatically.

### 4.4 Problem 2: Web Audio vs. redirected streams (affects B4)

The original plan routes audio through Web Audio (`MediaElementSource → GainNode → …`) for normalization and crossfade. **For `redirect` delivery the browser ends up on a third-party CDN.** If that response has no CORS headers, a `MediaElementSource` outputs **silence** (the media is cross-origin tainted). Setting `crossOrigin="anonymous"` on the element instead makes the load **fail** when the CDN has no CORS headers.

Required approach:
- Default path, no Web Audio: two plain `<audio>` elements (current + preloaded next). Apply normalization with `element.volume = userVolume × 10^(gainDb/20)`, clamped to ≤ 1. Most loudness normalization is attenuation, so this covers nearly all cases. Gapless = start the preloaded element at the current one's `ended` (or slightly before, using `timeupdate`).
- Web Audio (positive gain boost, crossfade, analyser) only for **same-origin** streams (`proxy`/`materialize` deliveries, which serve from `/v1/stream/` on our origin). Decide per source from `selected.delivery`.
- Verify in a real browser with one `redirect` source and one `proxy` source that both are audible. This is the check most likely to fail silently.
- Alternative to raise with the user if normalization boost on redirected sources matters: the engine setting `PROVIDER_MONOCHROME_DELIVERY=proxy` makes those same-origin at the cost of server bandwidth.

### 4.5 Phase A lessons (these caused real bugs)

- **Tailwind `@theme { --*: initial }` wipes every namespace.** Any utility whose namespace is not re-declared silently generates nothing (this broke `max-w-*` and `bg-black/50`). Before using a new utility category (`blur-*`, `z-*` named values, `animate-*`, `inset-shadow-*` etc.), confirm the token exists in `app.css` or add it. Verify by checking computed styles, not screenshots.
- **No `tailwindcss-animate`.** Classes like `animate-in`, `fade-in-0`, `zoom-in-95` from bits-ui examples do nothing here. Use `naad-anim-fade`, `naad-anim-scale`, `naad-anim-toast` from `app.css`, or add new keyframes there on the same duration/easing tokens.
- **Responsive grids must change via CSS media queries** (e.g. `sm:[--track-row-grid:…]` arbitrary-property utilities), never a single value computed in JS, or hidden columns still take space (this hid all track titles on mobile).
- **Never name a Svelte prop or variable `state`.** It collides with the `$state` rune. `TrackRow` uses `status`.
- **Values derived from `$props()` need `$derived(...)`**, or they capture only the initial value.
- **Biome + Svelte:** `noUnusedImports`/`noUnusedVariables` are off for `*.svelte` in `biome.json` (false positives). Keep that override.
- **TypeScript is pinned to `^5.9.3` in naad-web on purpose** (openapi-typescript peer range). The engine uses TS 7. Do not "unify" them.
- **Verification method that works:** chrome-devtools MCP (`resize_page`, `take_screenshot`, and `evaluate_script` with `getComputedStyle` / walking `document.styleSheets`) to prove a style actually applied. Full-page screenshots duplicate sticky headers; that is a capture artefact, check with a viewport screenshot. To switch theme in tests call the app's toggle; setting `data-theme` by hand leaves the theme store stale.

---

## 5. Phase B: the three signature screens, with real data

Order matters: each step builds on the last. Sub-gates keep reviews small.

Start with the engine's per-track `quality` summary (section 7.2) alongside B0, because B1 generates the API types from the engine and they must include `quality` from the first run. The artwork proxy (7.1) is needed by B5; the Caddy change (7.3) can come any time before Phase D.

### B0. Tooling (no UI)

- Add `vitest.config.ts` (or a `test` block in `vite.config.ts`) following the **current** Vitest + SvelteKit docs. Unit tests run in Node/jsdom as appropriate. Add `"test": "vitest run"`.
- Pin the dev port: add `port: 5173, strictPort: true` to `server` in `vite.config.ts`. Today no port is set, so Vite silently moves to the next free port (Phase A ran on 5180), which would make any hardcoded test URL flaky.
- Add `playwright.config.ts`: `webServer` runs `npm run dev` with `url: 'http://localhost:5173'`, `baseURL` the same, projects for 1440×900 and 390×844. Tests assume the engine is running at `NAAD_ENGINE_URL`. Add `"test:e2e": "playwright test"`. Browsers are not downloaded yet: run `npx playwright install chromium` first.
- Add `"api:gen": "openapi-typescript http://127.0.0.1:8080/v1/openapi.json -o src/lib/api/schema.d.ts"` (engine must be running). Commit nothing; the user decides whether the generated file is checked in.

**Accept:** `npm run test` runs (a trivial test passes), `npm run test:e2e` launches, `npm run api:gen` produces `schema.d.ts`.

### B1. API layer

- `src/lib/api/client.ts`: `openapi-fetch` client, base URL relative (`/`) so the Vite proxy and Caddy both work. Adds `Authorization: Bearer <key>` when a key is stored (`localStorage` key `naad:apiKey`). Turns problem+json responses into a typed `ApiError {status, code (from type suffix), detail, requestId}`. A 401 routes to a first-run key screen (can be a minimal Settings stub for now).
- Replace `src/lib/types.ts` with re-exports of generated component types (`components['schemas']['Track']` etc.) so existing components keep compiling. Keep field names. Fix fallout: `Track.source?` goes away and `TrackRow`/`QualityBadge` read the new `Track.quality` (4.3, 7.2). `QualityBadge` must accept both a `quality` summary (rows) and a full `Source` (Now Playing, Signal path); both share `tier`, `codec`, `bitDepth`, `sampleRate`, `bitrateKbps`. Update `src/lib/fixtures.ts` to the new shape (and include tracks with `quality: null`) so `/kit` keeps working.
- Do the engine change in 7.2 **before** running `api:gen` for the first time, so the generated types include `quality` from the start.
- `src/lib/queries/`: TanStack Query (Svelte 5 adapter, check current docs for the runes API) hooks: `home`, `album(id)`, `track(id)`, `lyrics(id)`, `likedContains(ids)`, `sources(id)` (never auto-refetched; `staleTime` below `expiresAt`). `QueryClientProvider` in the root layout.
- Unit tests: problem+json → `ApiError` mapping; auth header present/absent.

### B2. App shell

- Root `+layout.svelte`: sidebar (Home, Search, Library, and the playlist list from `/v1/library/playlists`), content area, fixed 72 px player bar, mobile bottom nav and mini player below `sm`. The shell and the player live here so navigation never interrupts playback.
- Right panel (desktop, collapsible, width remembered per viewer in `localStorage`): hosts Up next and Lyrics for the current track. Hidden below `lg`; on mobile these live in Now Playing.
- Player bar shows static state from the player store for now (wired in B4): artwork, title/artist, transport buttons, scrubber, volume, quality badge. A thin top edge tinted with `--ambient-1` (the only ambient use outside Now Playing).
- Content area uses the 12-column grid.
- Existing `ToastViewport` stays in the layout.

**GATE B2:** screenshots of the empty shell at 1440×900 and 390×844, dark and light.

### B3. Home and Album

- **Home** (`src/routes/+page.svelte`): render `/v1/home` sections with `Shelf` + `MediaCard` by `kind`, with `tracks` sections as a compact `TrackTable` or card shelf (pick one and justify it in the review). Loading = skeletons matching the real layout; error = inline problem message with retry; empty library = a short plain-language EmptyState pointing to Search and Import.
- **Album** (`src/routes/album/[id]/+page.svelte`): liner-notes header (large artwork, Fraunces title, artists linked, type, release year, label, UPC, track count, total duration), Play / Shuffle / Save actions, `TrackTable` with disc grouping when `discNumber` > 1 exists, per-track ISRC in a details area. Liked hearts from one batched `contains` call.
- The original plan lists "credits" on liner-notes pages. The engine has **no credits data** (no writer/producer fields on Album or Track). Show what exists (artists, label, UPC, ISRC, release date) and do not invent a credits section. Mention it in the review as a possible future engine feature.
- Quality column: from `track.quality` (4.3). For the review, make sure the album shown has a mix of played tracks (badges) and unplayed ones (`null`, empty cell), so both states are checked with real data.

**GATE B3:** Home and an album with Hindi titles and an album with Western titles, 1440 and 390, dark and light.

### B4. Player engine (the riskiest part; read 4.4 again)

Files: `src/lib/player/engine.svelte.ts` (state), `audio-graph.ts`, `scheduler.ts`, `media-session.ts`, `history.ts`.

- **State:** queue (tracks + context `{type, id}`), index, shuffle (keep the original order so un-shuffle restores it), repeat (`off | all | one`), position, duration, buffering, volume (persisted), quality preference (`max` default, persisted).
- **Load a track:** `/sources?quality=` → set the idle element's `src = play.url` → apply normalization (4.4) → play. Show a buffering state; `materialize` sources can take seconds.
- **Gapless:** when the current track is loaded, resolve the next track and preload it into the second element. Swap at `ended`. Measure the gap (see 8.3).
- **Crossfade** (setting, default off, 0–12 s): start the next element `crossfade` seconds before the end and ramp the two volumes in opposite directions. With plain elements, ramp `element.volume` in small steps (on `requestAnimationFrame`, not a fixed timer that stalls in background tabs); with same-origin sources a Web Audio gain ramp is smoother. Crossfade is skipped between consecutive tracks of the same album (so continuous albums stay gapless).
- **Prefetch:** `POST /v1/player/prefetch` with the next ≤ 10 ids when the queue changes (debounced; respect the 60/min budget).
- **Expiry and failure:** described in 4.2. On `error`: re-resolve once with `refresh=true`, restore position, play. Try an `alternatives` source if that fails. After that, toast ("Couldn't play *title*, skipped") and skip.
- **Media Session:** metadata (title, artist, album, artwork at several sizes), action handlers (play, pause, previous, next, seekto, seekbackward/forward), `setPositionState` on timeupdate (throttled).
- **History:** record `{trackId, startedAt (ISO with offset), msPlayed, completed, context, sourceProvider}` per play. Batch; flush on 20 items, 60 s, and `pagehide`/`visibilitychange: hidden` (use `fetch` with `keepalive: true`; `sendBeacon` cannot send the Bearer header).
- Wire the player bar and every "Play" button (TrackRow, album Play/Shuffle, MediaCard) to the engine.
- **Unit tests (Vitest, no audio needed):** queue next/previous at the ends with each repeat mode, shuffle then un-shuffle order, "play from index", expiry-refresh decision logic (mock clock), history batching and flush triggers, normalization gain → volume math including clamping.

**GATE B4:** a short report with the manual audio checks in 8.3 (each marked verified / not verified), plus unit test output.

### B5. Now Playing

- Route or overlay (`src/routes/now-playing/`): desktop full-screen overlay, mobile full-height sheet. Opening from the player bar artwork should use the View Transitions API (artwork morphs), with a no-motion fallback.
- Backdrop: blurred, darkened artwork plus ambient colours (`src/lib/color/ambient.ts`: median-cut on a 64×64 canvas, cached per image URL, sets `--ambient-1/2`). **Needs the artwork proxy** (section 7), because canvas reads of third-party images are blocked without CORS. Until the proxy exists, fall back to the default surface tones.
- Tabs: **Lyrics** (synced: active line full contrast, others dimmed, auto-scroll that pauses when the user scrolls and resumes after a few seconds, click a line to seek; plain-only: static text; none: a quiet empty state), **Up next** (queue list; reordering can wait for Phase C), **Signal path** (selected Source: provider, codec, container, bit depth, sample rate, bitrate, delivery, normalization gain/LUFS, verifiedAt; plus the alternatives list).
- `QualityBadge` click (anywhere) opens the Signal path card.

**GATE B5 = Review 2:** Home, Album, Now Playing (with synced Hindi lyrics and with Western lyrics), each at 1440×900 and 390×844, dark and light, all with real engine data. Check every screenshot against the ban list in section 3 and say, per screen, what you checked.

---

## 6. Phase C: the rest of the app

Each item ends with screenshots in both themes and both widths. Batch them into one **GATE C** review unless the user asks for more frequent reviews.

- **Search** (`/search`): as-you-type (debounced ~250 ms, cancel stale requests), a top result, typed tabs (Tracks, Albums, Artists, Playlists). Hindi query works.
- **Artist** (`/artist/[id]`): liner-notes header, Follow, top tracks table, albums and singles shelves, related artists, "Start radio".
- **Playlist** (`/playlist/[id]`): paged items (`cursor`), edit title/description (`PATCH`), delete, duplicate, add/remove items, **drag to reorder** using `POST …/items/:itemId/move` with `afterItemId` (optimistic update, roll back on error). Keyboard reorder alternative for accessibility.
- **Library** (`/library/tracks|albums|artists|playlists|history`): liked songs (optimistic like/unlike everywhere), saved albums, followed artists, playlists, history (paged).
- **Radio:** "Start radio" on tracks, albums, artists, playlists (`/v1/radio?seed=type:id`). When the queue runs low in radio mode, fetch more with `exclude` = already queued/played ids.
- **Up next panel:** reorderable queue, remove item, clear.
- **Import** (`/import`): paste a link → `POST /v1/imports` → poll `GET /v1/imports/:id` (back off; stop when finished) → progress → result playlist link and the unmatched-tracks report.
- **Settings** (`/settings`):
  - API key (masked, with a test button that makes a cheap `/v1` call).
  - Engine URL: default empty = same origin (the Caddy setup). When set, the API client uses it as its base URL; the engine's `CORS_ORIGINS` must then include the app origin (say so in the UI).
  - Quality preference, separately for **Wi-Fi** and **cellular** (`max | hires | lossless | high | standard`). Pick between them with `navigator.connection.type` where the browser supports it (Chromium-based); elsewhere use the Wi-Fi setting and label the cellular one as "used when the browser can detect it".
  - Normalization on/off, crossfade length, theme (via `theme.set`), clear local data.
- **Keyboard map** in `src/lib/keys.ts`: one table of shortcuts and command palette actions, shared by the global key handler and the palette so they never drift apart.
- **Command palette** (Ctrl/Cmd+K) with bits-ui: navigate, search, player actions, from `keys.ts`.
- **Keyboard:** Space play/pause, ←/→ seek ±5 s, Shift+←/→ previous/next, L like current track. Ignore when focus is in a text input.
- **Context menus:** right-click on desktop, long-press on touch, using the existing `Menu`: Play next, Add to queue, Add to playlist, Like, Go to album, Go to artist, Start radio.
- **Mobile row actions:** `TrackRow` hides like/menu below `sm` (see the comment in `TrackRow.svelte`). Decide the mobile pattern (recommended: tap row plays, long-press or a trailing ⋯ button opens the menu sheet) and implement it.

---

## 7. Engine changes (naad-v3)

Follow the engine's existing patterns: Zod schemas in `src/http/schemas.ts`, routes registered in `src/http/app.ts`, services wired in `src/app/container.ts`, problem+json errors via `AppError`. Add tests next to the existing ones (`test/unit`, `test/integration`). Remember rule 0.2.

1. **Artwork proxy** `GET /v1/art?src=<url>&size=<px>`
   - Why: makes artwork pixels readable by canvas (ambient colour) and hides the listener's browser from third-party image hosts.
   - Host allowlist: exactly the image hosts the catalog integrations return (collect them from `src/integrations/*`). Reject anything else with 400. Protect against SSRF the same way the audio fetch does (`src/platform/stream-fetch.ts`: no private IPs, no redirects to disallowed hosts).
   - Use a host's URL size template where one exists (JioSaavn, iTunes, Deezer image URLs encode size), otherwise pass through. Long cache headers (`public, max-age=604800, immutable`), plus `access-control-allow-origin` for the app origin. Cap response size.
   - Decide whether `/v1/art` needs the API key: `<img src>` cannot send a Bearer header, so it should be exempt like `/v1/stream/` (add it to the exemption in `registerApiKey`, `src/http/plugins.ts`). The allowlist keeps it from being an open proxy.
   - Frontend: an `artUrl(src, size)` helper used by `Artwork` and the ambient extractor.
2. **Per-track quality summary** (decided, see 4.3). Do this at the start of Phase B (before B1's first `api:gen`).
   - **Schema** (`src/http/schemas.ts`): add to `TrackSchema`
     `quality: z.object({ tier: z.enum(['standard','high','lossless','hires']), codec: z.string(), bitDepth: z.number().int().nullable(), sampleRate: z.number().int().nullable(), bitrateKbps: z.number().int().nullable(), provider: z.string(), verifiedAt: z.string() }).nullable().describe('Best quality NAAD has measured for this track; null until a source has been resolved')`.
     Register it as a named component (`.meta({ id: 'TrackQuality' })`) so the generated client gets a clean type.
   - **Type** (`src/modules/catalog/store.ts`): add `quality: TrackQuality | null` to `TrackView` as a **required** field (not optional), so `npm run typecheck` flags every place that builds a track without it.
   - **Query** (`CatalogStore.getTracks(ids)`, which every track-returning route goes through): one extra batched query on `track_sources` for all ids, keeping only usable rows (`fail_count < MAX_FAILS`, the same rule the resolver uses; `MAX_FAILS` is a private constant in `src/modules/playback/resolver.ts`, so export it or move it to `src/modules/playback/types.ts`). Pick the best row per track: highest `tier`, then highest `bit_depth`, then `sample_rate`, then `bitrate_kbps`. Postgres `DISTINCT ON (track_id) … ORDER BY track_id, tier DESC, bit_depth DESC NULLS LAST, sample_rate DESC NULLS LAST, bitrate_kbps DESC NULLS LAST` does this in one query. Map the numeric tier with `TIER_NAMES` from `src/modules/playback/types.ts`. No N+1, no upstream calls.
   - **Check every route response** that uses `TrackSchema` still serializes (search, track, album, artist top tracks, playlist items, home/charts/radio/mixes, liked tracks, history, resolve). A missing field would fail response validation with a 500, so run the integration suite.
   - **Tests:** unit test for the "best row" ordering (hi-res beats lossless; among equal tiers, 24/96 beats 24/48; a row with `fail_count` ≥ `MAX_FAILS` is ignored). Integration test: a track with a stored hi-res source returns `quality.tier === 'hires'` from `GET /v1/albums/:id`; a track with no stored source returns `quality: null`; after a source is marked failed 3 times, the next-best source is reported.
   - **Performance:** confirm `track_sources` has an index usable for `track_id` lookups (the unique index `(track_id, provider)` leads with `track_id`, so it should be). Check an album with 30+ tracks responds without a noticeable slowdown.
   - Regenerate the web client (`npm run api:gen` in naad-web) after the engine change.
3. **Serve the app from Caddy** (`docker/Caddyfile`, `docker/compose.yml`): today Caddy only does `reverse_proxy api:8080`. Change to: `handle /v1/* /healthz /readyz /docs*` → `reverse_proxy api:8080` (keep `flush_interval -1` and the JSON-only `encode`), everything else → `root` at the naad-web build + `try_files {path} /200.html` + `file_server`. Mount the web build into the Caddy container (a volume or a build stage). Result: one origin, no CORS.

**Engine gate for every change:** `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:integration` (needs Postgres/Redis), `npm run smoke`, all passing.

---

## 8. Testing

### 8.1 Commands

| Repo | Command | Status |
| --- | --- | --- |
| naad-web | `npm run check` | exists |
| naad-web | `npm run lint` | exists |
| naad-web | `npm run test` (Vitest) | **create in B0** |
| naad-web | `npm run test:e2e` (Playwright) | **create in B0** |
| naad-web | `npm run api:gen` | **create in B0** |
| naad-web | `npm run build` then `npm run preview` | exists; run before each gate |
| naad-v3 | `npm run typecheck`, `lint`, `test`, `test:integration`, `test:all`, `smoke` | exist |

Every gate: `check`, `lint`, `test` clean in naad-web, and the engine suite green if the engine was touched.

### 8.2 Automated tests to write

**Unit (Vitest):** format helpers (including `durationMs: null`), `QualityBadge` label for a `quality` summary and for a full `Source` (same text for the same values), `TrackRow` with `quality: null` (empty cell, column kept), ApiError mapping, queue/shuffle/repeat, expiry-refresh logic, history batching, normalization math, ambient palette extraction (feed a known image, check the dominant colours), search debounce/cancel.

**End-to-end (Playwright, against a live engine):**
1. Home loads with real sections, no console errors.
2. Search "kesariya" → play first track → player bar shows it, the audio element is playing (`!paused`, `currentTime` increases). Then open that track's album: its row now shows a quality badge (the `quality` summary filled in after playback).
3. Seek via the scrubber → `currentTime` jumps.
4. Next → second track plays, the first element is released.
5. Like → reload → still liked.
6. Create playlist → add track → reorder → reload → order kept.
7. Navigate across every route while playing → playback never stops (`currentTime` keeps increasing).
8. Import a small public playlist link → progress → finished playlist appears in the library.
9. Keyboard shortcuts (Space, arrows, L).
10. Mobile viewport: bottom nav, mini player, Now Playing sheet opens and closes.

Keep e2e tests independent of exact catalog content (assert structure, not specific titles), because upstream catalogs change.

### 8.3 Manual audio checks (cannot be screenshotted)

Report each as **verified**, **failed** or **not verified (why)**. Never mark verified without actually doing it.

- **Audible on both delivery types:** one `redirect` source and one `proxy` source both produce sound (4.4).
- **Gapless:** play a continuous album (live album, or a DJ mix) across a track boundary. No audible gap. Also log the measured gap (time between `ended` on one element and `playing` on the next); target < 50 ms.
- **Normalization:** two tracks with different `gainDb` sound at similar loudness; the effective `volume` matches the formula.
- **Crossfade:** with a 6 s crossfade, two unrelated tracks overlap smoothly with no volume jump; two consecutive tracks from the same album still hand off gaplessly with no fade.
- **Playback survives navigation:** play, then visit every route (including Settings and Import) and open/close Now Playing; audio never stops or restarts.
- **Media keys and lock screen:** hardware play/pause/next work; the OS media overlay shows title, artist, artwork.
- **Expiry recovery:** set `PLAY_TOKEN_TTL_SECONDS=60` on the engine, pause for over a minute, press play (and seek) → playback resumes at the same position.
- **Source failure:** disable the selected provider in the engine `.env` mid-session → next play falls back or skips with a toast, no hang.
- **Background tab:** playback and track advance continue with the tab hidden.

### 8.4 Screenshot review protocol

- chrome-devtools MCP at 1440×900 and 390×844, dark and light (toggle through the app, not by editing `data-theme`).
- For each screen, check the ban list (section 3) and state what was checked.
- When something looks right, still spot-check with `getComputedStyle` for the risky items: max-width containers, overlay backgrounds, animations, grid columns at 390 px, text truncation.
- Real data only. Include at least one Hindi album and one Western album, a long title, a track without artwork, and an explicit track.

---

## 9. Phase D: polish and hardening

- **PWA:** the manifest in `vite.config.ts` references `/icons/icon-192.png`, `/icons/icon-512.png` and `/icons/icon-512-maskable.png`, **which do not exist** in `static/` yet. Create them (from the NAAD mark, on the warm near-black surface), then verify install and the offline app shell. Audio and `/v1` stay network-only.
- **States:** empty, error and offline states in the NAAD voice (short, plain, no exclamation marks); skeletons matching real layouts, no shimmer.
- **Accessibility:** focus order, visible focus everywhere, ARIA on custom controls (scrubber, lyrics lines, reorder), contrast ≥ 4.5:1 in both themes (check `--ink-faint` on surfaces), `prefers-reduced-motion` disables the View Transition morph and lyric auto-scroll animation.
- **Performance:** first-load JS ≤ 150 KB gzip (measure from `npm run build` output), virtualize long lists (liked songs, big playlists, history) for 60 fps scrolling, lazy-load route code, `loading="lazy"` artwork.
- **Lighthouse** (chrome-devtools MCP `lighthouse_audit`, on `npm run preview`): performance ≥ 90, accessibility ≥ 95.
- **Review 3 (GATE D):** a full walkthrough with screenshots of every route in both themes and both widths, the e2e run output, the Lighthouse scores, the bundle size, and the manual audio checklist.

---

## 10. Open questions to ask the user at the right time

| When | Question |
| --- | --- |
| Before B4 | Is normalization boost on `redirect` sources worth routing Monochrome through `proxy` delivery (server bandwidth)? Default: no, attenuation-only via `volume`. |
| B0 | Should the generated `src/lib/api/schema.d.ts` be checked in or regenerated on demand? |
| Phase C | Mobile row actions: recommended pattern from section 6, or another? |
| Any time | Commits: only when the user asks. |

---

## Appendix A. The original approved plan (full text)

This is the plan the user approved before Phase A, reproduced word for word below (only its heading levels are shifted down so they nest under this appendix). Phase A of it is done. Everything else in it is still required, as refined by the sections above.

### A.1 Where this handoff overrides the original plan

| Original plan says | Now | Why |
| --- | --- | --- |
| Kit route `/_kit` | `/kit` | SvelteKit treats `_`-prefixed route folders as private (not routable) |
| Audio always through Web Audio (`MediaElementSource → gain → crossfade → analyser`); normalization via a GainNode | Plain `<audio>` elements by default, normalization via `element.volume`; Web Audio only for same-origin (`proxy`/`materialize`) sources | Redirected streams from third-party CDNs without CORS headers play **silent** through Web Audio (section 4.4) |
| "On an expired link or a 410 response, re-request sources" | Expired token returns **403**; **410** means the source is gone. Recover from the audio element's `error` event and proactively before `expiresAt` | Verified in `naad-v3/src/modules/playback/tokens.ts` and `service.ts` (section 4.2) |
| Quality badge on every track row | Kept, fed by a new engine field `Track.quality`: the best quality already measured and stored for that track (`null` until played). Decided with the user | `TrackSchema` had no source field and `/sources` is limited to 60/min (sections 4.3, 7.2) |
| Engine changes: artwork proxy only | Artwork proxy **and** the per-track `quality` summary | Needed for the quality badge (section 7.2) |
| Liner notes include "credits" | Show artists, label, UPC, ISRC, release date only | The engine has no credits data (section 5, B3) |
| Artwork proxy listed with Phase B | Still Phase B (section 7.1); also exempt from the API key | `<img src>` cannot send a Bearer header |
| Caddy "serves the naad-web build" | Must be added: today `docker/Caddyfile` only reverse-proxies to the API (section 7.3) | Verified in the repo |
| Library types from `api:gen` | `api:gen` script does not exist yet; hand-written `src/lib/types.ts` in the meantime (task B0/B1) | Verified in `package.json` |
| Vitest and Playwright for tests | Installed but not configured; setting them up is task B0 | Verified in the repo |
| Settings: "quality (wifi/cellular)" | Cellular detection only works where `navigator.connection.type` exists (Chromium) | Browser support (section 6, Settings) |

### A.2 Full text: "NAAD Web: Frontend Plan"


#### Context

The naad-v3 engine is finished: it has a typed OpenAPI contract, signed play links, library, discovery, lyrics and import. It now needs its own frontend.

Decisions already made with you:
- **Stack:** SvelteKit in single-page mode, with a typed API client.
- **Layout:** our own design that borrows the best layout patterns. From Spotify, the desktop shell. From Apple Music, Now Playing and lyrics. From YouTube Music, the home shelves and radio.
- **Private project:** nothing is published or shared.

The new requirement is that it must **not look like a typical AI-generated design**. So this plan treats visual design as an engineering problem: a defined visual language, explicit bans, real data from the first screen onward, and screenshot reviews at fixed checkpoints.

#### 1. Design direction: "Signal & Sleeve"

The concept is **a hi-fi component crossed with a record sleeve.** Precise technical readouts sit next to editorial, artwork-led pages. It grows out of what NAAD really is: an engine obsessed with audio quality, playing a large Indian and global catalog. The name itself means primordial sound.

##### What makes UI look "cheap AI-generated", and what we do instead

| Banned (the AI tells) | What NAAD does instead |
| --- | --- |
| Indigo-to-purple gradients, glowing blobs, gradient text | Warm neutral surfaces. Colour comes **only** from the artwork currently playing, plus one functional accent |
| Glassmorphism and blur on every surface | Solid surfaces. Blur appears in exactly one place: the Now Playing backdrop built from the artwork |
| Inter everywhere, same weight, centred everything | A deliberate type system (below), left-aligned and grid-based, with real hierarchy |
| `rounded-2xl` cards with drop shadows everywhere | 2–4 px radii, hairline 1 px dividers, no card shadows. Lists are real tables with aligned columns |
| Lucide icons at one stroke weight, emoji in the UI | Custom-drawn transport icons (play, pause, skip, repeat, shuffle) plus Phosphor at the *light* weight elsewhere. No emoji |
| Hero banners, "Welcome back!" copy, marketing tone | No hero. Content starts at the top. Short, plain labels ("Jump back in", "Up next") |
| Uniform 16 px spacing, everything the same size | A 4 px base grid with a real density scale. Tracklists are compact; artwork pages breathe |
| Decorative motion (bouncing, pulsing, shimmer everywhere) | Motion only when it explains something: artwork morphs into Now Playing, the queue reorders physically, lyrics scroll |
| Placeholder art, lorem ipsum, fake numbers | Every screen is built and reviewed against **real engine data** from day one |

##### Visual language

- **Type** (all self-hosted through @fontsource, with no Google Fonts requests):
  - **Fraunces** (variable, optical sizing) is used only for large display titles: album, artist and playlist names, and the Now Playing title. It gives the editorial, "sleeve" warmth.
  - **IBM Plex Sans** handles all UI text.
  - **IBM Plex Sans Devanagari** covers Hindi titles and lyrics, so they match Plex instead of falling back to a system font. This matters for this catalog.
  - **IBM Plex Mono** is for the "signal" layer: time codes, the quality readout (`FLAC 24/96`), track numbers and durations, all with tabular figures.
  - Type scale: 12 / 13 / 15 / 18 / 24 / 36 / 56 / 88 (display only).
- **Colour:**
  - Dark theme: warm near-black `#141312` (not pure black, not blue-grey), a raised surface at `#1C1B19`, primary text `#ECE8E1`, muted text at about 60%.
  - Light theme: a "paper" palette (`#F4F1EA`, ink `#1A1917`).
  - One functional accent, **phosphor amber** `#FFB547`, echoing hi-fi display panels. It is reserved for *signal*: the Hi-Res badge, the live playing indicator, and focus rings.
  - Per-track **ambient colour** is taken from the artwork. It is used only for the Now Playing backdrop and a thin tint on the player bar, never for buttons.
- **Grid and density:** a 12-column layout in the content area and a fixed 72 px player bar. Tracklist rows are 44 px desktop / 56 px touch, with columns #, title/artists, album, quality and time. Artwork is square with a 3 px radius and appears at a small set of sizes.
- **Signature elements (what makes it NAAD, not a clone):**
  1. **The quality readout.** A mono, small-caps badge (`HI-RES · FLAC 24/96`, `LOSSLESS 16/44.1`, `AAC 320`), amber only for hi-res. Clicking it opens the **Signal path** card: source provider, codec, bit depth, sample rate, delivery and normalization gain.
  2. **Liner-notes pages.** Album and artist pages are laid out like the inside of a record sleeve: a large Fraunces title, then credits, release date, label, UPC and ISRC, all set in the type system.
  3. **Lyrics as a stage.** Synced lines in large Plex (Devanagari where needed). The active line is full contrast and the rest are dimmed. Clicking a line seeks to it.
  4. **Waveform-free progress:** a hairline scrubber with a mono timecode. No fake waveform, since the engine gives none.
- **Motion:** the View Transitions API for artwork → Now Playing, and 120–200 ms ease-out curves. `prefers-reduced-motion` is fully respected.

#### 2. Stack (versions checked on npm today)

- **App:** SvelteKit 2.70 + Svelte 5.57 (runes), Vite 8, TypeScript strict, `@sveltejs/adapter-static` 3 (single-page app with a fallback page).
- **API:**
  - `openapi-typescript` 7 generates types from naad-v3 `/v1/openapi.json`, and `openapi-fetch` 0.17 uses them. The whole API is typed from one command (`npm run api:gen`).
  - `@tanstack/svelte-query` 6 handles caching, refetching and optimistic likes and playlist edits.
- **UI:**
  - Tailwind CSS 4.3 is used **only as the token system**: `@theme` holds our colours, type and spacing, and the Tailwind defaults are disabled.
  - bits-ui 2.19 supplies headless, accessible primitives (menus, dialogs, sliders, context menus), styled by us.
  - phosphor-svelte 3 at the light weight, plus our own SVG transport icons.
- **Other:**
  - `@vite-pwa/sveltekit` for installing to the home screen and caching the app shell.
  - vitest for unit tests, and Playwright 1.63 for end-to-end tests against a running engine.

#### 3. Architecture

New private repo at `D:\Dev\Projects\music\naad-web`:

```text
src/
  app.css                   tokens (@theme), font faces, base styles, both themes
  lib/
    api/                    generated schema.d.ts + client.ts (auth header, problem+json → typed errors)
    queries/                svelte-query hooks per resource (search, track, album, artist, home, radio, library…)
    player/
      engine.svelte.ts      state: queue, index, shuffle/repeat, position, volume, quality preference
      audio-graph.ts        two <audio> elements → MediaElementSource → gain (normalization) → crossfade → analyser → out
      scheduler.ts          gapless/crossfade handoff, prefetch of next items (POST /v1/player/prefetch)
      media-session.ts      lock screen, hardware keys, artwork
      history.ts            batched play reports → POST /v1/history (flush on pagehide)
    color/ambient.ts        artwork palette extraction (median-cut on a 64×64 canvas), cached per image
    ui/                     design-system components: Button, IconButton, Badge (QualityBadge), TrackRow,
                            TrackTable, Artwork, Shelf, Scrubber, Sheet, Menu, Toast, EmptyState
    icons/                  custom transport SVGs
    keys.ts                 keyboard map + command palette actions
  routes/
    +layout.svelte          app shell: sidebar, content, right panel, player bar; owns the audio graph
    +page.svelte            Home (shelves)
    search/                 search with typed tabs and a top result
    album/[id], artist/[id], playlist/[id]
    library/(tracks|albums|artists|playlists|history)
    now-playing/            full-screen view (mobile sheet / desktop overlay) with lyrics/queue/signal tabs
    import/                 paste a link, watch progress, see the unmatched report
    settings/               API key, engine URL, quality (wifi/cellular), normalization, theme
```

**Player engine rules**
- The audio graph lives in the root layout, so navigation never interrupts playback.
- Gapless playback is done by preloading the next play link into the idle `<audio>` element and switching at `ended` (or overlapping for crossfade).
- The engine's `play.normalization.gainDb` is applied through a GainNode.
- A play link expires after 6 h. On an expired link or a 410 response, the player re-requests `/v1/tracks/:id/sources` and resumes at the same position.

#### 4. Small engine changes (naad-v3)

1. **Artwork proxy** `GET /v1/art?src=<url>&size=` with a host allowlist (the same image hosts the catalogs already return), resizing through URL templates where the host supports it, and long cache headers. Two reasons:
   - It makes pixels CORS-readable, so the ambient colour can be extracted.
   - It keeps third-party image hosts from seeing the listener's browser.
2. **Serving the app:**
   - In Compose, Caddy serves the `naad-web` static build at `/` and proxies `/v1`, `/healthz` and `/docs` to the API. The app and the API share one origin, so no CORS is needed.
   - In development, a Vite proxy sends `/v1` to `localhost:8080`.
3. **API key:** entered once on the Settings / first-run screen, stored in `localStorage`, and sent as `Authorization: Bearer`. That's appropriate for a private, single-owner instance. Stream links need no key.

#### 5. Phases, each ending in a screenshot design review

- **Phase A: design system before features.**
  - Build the repo scaffold, tokens, fonts and both themes.
  - Build the UI kit components and a `/_kit` route that shows every component in every state (hover, focus, disabled, loading, empty, error, long Devanagari titles).
  - **Review 1:** screenshots of `/_kit` at 1440 px and 390 px, checked against the ban list above.
- **Phase B: three signature screens with real data.**
  - App shell, then Home, then the Album page (liner notes, tracklist, quality badges), then Now Playing with synced lyrics and the Signal path card.
  - Includes the player engine (single track, queue, gapless, Media Session) and the artwork proxy in the engine.
  - **Review 2:** screenshots of these three screens at desktop and mobile widths, in dark and light, using real Bollywood and Western tracks.
- **Phase C: the rest of the app.**
  - Search (top result, typed tabs, as-you-type), Artist, Playlist (reorder by dragging), Library sections, History, Radio ("Start radio" everywhere, and an Up next panel you can reorder), Import, Settings.
  - A command palette (Ctrl+K), keyboard shortcuts (Space, ←/→ to seek, Shift+←/→ for previous/next, L to like), and right-click / long-press context menus.
- **Phase D: polish and hardening.**
  - PWA; empty, error and offline states in the NAAD voice; skeletons that match the real layouts (no shimmer).
  - Accessibility pass (focus order, ARIA on custom controls, contrast ≥ 4.5:1, reduced motion); performance budget (first load under 150 KB JS gzip, 60 fps scrolling on long lists through virtualization).
  - **Review 3:** a full walkthrough.

#### 6. Verification

- **Design reviews:** at each checkpoint I take screenshots with the chrome-devtools MCP (1440×900 and 390×844, both themes) and check them against the ban list and the visual language. You get the screenshots before the next phase starts.
- **Behaviour:**
  - Playwright end-to-end tests against a live engine: search → play → seek → next (gapless handoff) → like → add to playlist → reorder → reload (the library persists) → import a Spotify link and watch progress to completion.
  - Unit tests (vitest) for queue/shuffle/repeat logic, the play-link expiry refresh, history batching, and palette extraction.
- **Audio checks in a real browser:**
  - No gap at track boundaries on an album with continuous tracks.
  - Normalization gain is applied.
  - Media keys work.
  - Playback survives navigating between every route.
- **Quality gates:** `svelte-check`, biome, Lighthouse (performance ≥ 90, accessibility ≥ 95), and the bundle size budget.
