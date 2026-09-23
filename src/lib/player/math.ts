/**
 * Pure player mathematics and utility functions.
 * Fully tested via Vitest with zero browser audio dependencies.
 */

/**
 * Normalization gain -> effective volume calculation.
 * Clamps volume to [0, 1].
 * Formula: userVolume * 10^(gainDb / 20), clamped to <= 1 (attenuation-only).
 */
export function calculateEffectiveVolume(userVolume: number, gainDb: number | null | undefined): number {
  const baseVol = Math.max(0, Math.min(1, userVolume));
  if (gainDb == null || !Number.isFinite(gainDb)) {
    return baseVol;
  }
  const factor = 10 ** (gainDb / 20);
  return Math.max(0, Math.min(1, baseVol * factor));
}

/**
 * Checks if a play token is expiring soon (within thresholdMs).
 * Defaults to 2 minutes (120,000 ms).
 */
export function isTokenExpiringSoon(
  expiresAt: string | null | undefined,
  thresholdMs = 120_000,
  now = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return false;
  return expiry - now <= thresholdMs;
}

/**
 * Formats a Date object as an ISO 8601 string WITH timezone offset (e.g. 2026-09-23T16:20:00+05:30)
 * as required by the naad-v3 POST /v1/history contract.
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
