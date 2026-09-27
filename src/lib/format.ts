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

export function formatBitrate(kbps?: number | null): string {
  if (!kbps || kbps <= 0) return '—';
  return `${kbps.toLocaleString()} kbps`;
}

export function formatSampleRate(hz?: number | null): string {
  if (!hz || hz <= 0) return '—';
  if (hz >= 1000) {
    const khz = (hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1);
    return `${khz} kHz`;
  }
  return `${hz} Hz`;
}

/** Joins credited artist names the way a sleeve would: "A, B & C". */
export function joinArtists(artists?: (string | { name: string })[] | null): string {
  if (!artists || artists.length === 0) return '';
  const names = artists.map((a) => (typeof a === 'string' ? a : a.name));
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}
