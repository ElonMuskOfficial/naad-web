import { describe, expect, it } from 'vitest';
import { calculateEffectiveVolume, formatIsoWithOffset, isTokenExpiringSoon, shuffleArray } from './math';

describe('Player Math: calculateEffectiveVolume', () => {
  it('leaves volume unchanged when gainDb is 0 dB', () => {
    expect(calculateEffectiveVolume(0.8, 0)).toBeCloseTo(0.8, 5);
    expect(calculateEffectiveVolume(1.0, 0)).toBeCloseTo(1.0, 5);
  });

  it('leaves volume unchanged when gainDb is null or undefined', () => {
    expect(calculateEffectiveVolume(0.85, null)).toBe(0.85);
    expect(calculateEffectiveVolume(0.85, undefined)).toBe(0.85);
    expect(calculateEffectiveVolume(0.85, Number.NaN)).toBe(0.85);
  });

  it('attenuates volume with negative gainDb', () => {
    // -6 dB is approx factor of 0.501187
    const vol = calculateEffectiveVolume(1.0, -6);
    expect(vol).toBeCloseTo(0.501, 2);
    expect(vol).toBeLessThan(1.0);

    // -20 dB is factor of 0.1
    expect(calculateEffectiveVolume(1.0, -20)).toBeCloseTo(0.1, 4);
    expect(calculateEffectiveVolume(0.5, -20)).toBeCloseTo(0.05, 4);
  });

  it('clamps positive gainDb boost to <= 1 (attenuation-only safety)', () => {
    // +6 dB on 0.8 volume = 0.8 * 1.995 = 1.596 -> clamped to 1.0
    expect(calculateEffectiveVolume(0.8, 6)).toBe(1.0);
    expect(calculateEffectiveVolume(1.0, 10)).toBe(1.0);
  });

  it('clamps userVolume input within [0, 1]', () => {
    expect(calculateEffectiveVolume(-0.5, 0)).toBe(0);
    expect(calculateEffectiveVolume(1.5, 0)).toBe(1);
  });
});

describe('Player Math: isTokenExpiringSoon', () => {
  const now = 1_700_000_000_000;

  it('returns false for null or empty expiresAt', () => {
    expect(isTokenExpiringSoon(null, 120_000, now)).toBe(false);
    expect(isTokenExpiringSoon(undefined, 120_000, now)).toBe(false);
    expect(isTokenExpiringSoon('', 120_000, now)).toBe(false);
    expect(isTokenExpiringSoon('invalid-date', 120_000, now)).toBe(false);
  });

  it('returns true when token has already expired', () => {
    const expiredIso = new Date(now - 10_000).toISOString();
    expect(isTokenExpiringSoon(expiredIso, 120_000, now)).toBe(true);
  });

  it('returns true when token is within threshold (e.g. 60s remaining < 120s)', () => {
    const expiringSoonIso = new Date(now + 60_000).toISOString();
    expect(isTokenExpiringSoon(expiringSoonIso, 120_000, now)).toBe(true);
  });

  it('returns false when token has plenty of time left (e.g. 1 hour remaining)', () => {
    const safeIso = new Date(now + 3_600_000).toISOString();
    expect(isTokenExpiringSoon(safeIso, 120_000, now)).toBe(false);
  });
});

describe('Player Math: formatIsoWithOffset', () => {
  it('formats a date as ISO 8601 with timezone offset', () => {
    const formatted = formatIsoWithOffset();
    // Matches YYYY-MM-DDTHH:mm:ss.sss[+-]HH:mm
    const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/;
    expect(formatted).toMatch(regex);
  });
});

describe('Player Math: shuffleArray', () => {
  it('preserves array length and multiset contents', () => {
    const original = ['A', 'B', 'C', 'D', 'E'];
    const shuffled = shuffleArray(original);
    expect(shuffled).toHaveLength(original.length);
    expect([...shuffled].sort()).toEqual([...original].sort());
  });

  it('does not mutate the original array', () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    shuffleArray(original);
    expect(original).toEqual(copy);
  });

  it('deterministically shuffles with mock RNG', () => {
    // Reverse RNG
    const reverseRng = () => 0;
    const items = [1, 2, 3, 4];
    const shuffled = shuffleArray(items, reverseRng);
    expect(shuffled).toHaveLength(4);
    expect(shuffled).not.toEqual(items);
  });
});
