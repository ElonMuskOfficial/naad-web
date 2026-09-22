/** mm:ss (h:mm:ss past an hour). Used everywhere a duration or timecode is shown. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null) return '';
  return formatTime(ms / 1000);
}

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

/** Joins credited artist names the way a sleeve would: "A, B & C". */
export function joinArtists(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}
