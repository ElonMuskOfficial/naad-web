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
