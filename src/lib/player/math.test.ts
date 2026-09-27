import { describe, expect, it } from 'vitest';
import { formatIsoWithOffset, shuffleArray } from './math';

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
