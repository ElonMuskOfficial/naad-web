/**
 * Mirrors naad-v3's OpenAPI schemas (src/http/schemas.ts) by hand for Phase A/B, so the design
 * system and fixtures are shaped exactly like the real API. Phase C swaps these for the generated
 * types from `npm run api:gen` — field names are kept identical on purpose.
 */
import type { Tier } from './format';

export interface Image {
  url: string;
  width?: number;
  height?: number;
}

export interface ArtistRef {
  id: string;
  name: string;
}

export interface Track {
  id: string;
  title: string;
  versionTags: string[];
  artists: ArtistRef[];
  album: { id: string; title: string; images: Image[] } | null;
  durationMs: number | null;
  isrc: string | null;
  explicit: boolean;
  discNumber: number | null;
  trackNumber: number | null;
  images: Image[];
  /** Only present once the engine has resolved a playable source for this track. */
  source?: Source;
}

export interface Source {
  id: string;
  provider: string;
  tier: Tier;
  codec: string;
  container: string | null;
  mimeType: string;
  bitDepth: number | null;
  sampleRate: number | null;
  bitrateKbps: number | null;
  delivery: string;
  matchScore: number;
  normalization: { gainDb: number; lufs: number | null } | null;
  verifiedAt: string;
}

export interface Album {
  id: string;
  title: string;
  albumType: string;
  releaseDate: string | null;
  label: string | null;
  upc: string | null;
  trackCount: number | null;
  explicit: boolean;
  artists: ArtistRef[];
  images: Image[];
}

export interface Artist {
  id: string;
  name: string;
  images: Image[];
}

export interface Playlist {
  id: string;
  title: string;
  description: string | null;
  origin: string;
  inLibrary: boolean;
  images: Image[];
  trackCount: number;
}
