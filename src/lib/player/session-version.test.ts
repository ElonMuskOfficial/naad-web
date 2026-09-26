import { describe, expect, it } from 'vitest';
import { DATA_VERSION, DATA_VERSION_KEY, migrateSession } from './session-version';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const KEYS = ['naad:current_track', 'naad:queue', 'naad:queue_index'];

describe('migrateSession', () => {
  it('wipes the saved session of an older data version, once', () => {
    const s = fakeStorage({
      'naad:current_track': '{"id":"trk_1"}',
      'naad:queue': '[]',
      'naad:volume': '0.4',
    });
    expect(migrateSession(s, KEYS)).toBe(true);
    expect(s.getItem('naad:current_track')).toBeNull();
    expect(s.getItem('naad:queue')).toBeNull();
    expect(s.getItem(DATA_VERSION_KEY)).toBe(DATA_VERSION);
    expect(s.getItem('naad:volume')).toBe('0.4'); // settings are not session data
  });

  it('keeps the session once the version matches', () => {
    const s = fakeStorage({ [DATA_VERSION_KEY]: DATA_VERSION, 'naad:current_track': '{"id":"abc"}' });
    expect(migrateSession(s, KEYS)).toBe(false);
    expect(s.getItem('naad:current_track')).toBe('{"id":"abc"}');
  });

  it('marks a fresh browser as current without touching anything', () => {
    const s = fakeStorage();
    expect(migrateSession(s, KEYS)).toBe(true);
    expect(s.getItem(DATA_VERSION_KEY)).toBe(DATA_VERSION);
  });

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => migrateSession(broken, KEYS)).not.toThrow();
    expect(migrateSession(broken, KEYS)).toBe(false);
  });
});
