import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { artUrl, corsArtUrl } from './art';

describe('artUrl', () => {
  it('returns a saavncdn.com URL directly for plain display (no CORS needed)', () => {
    const url = artUrl('https://c.saavncdn.com/396/cover-150x150.jpg', 150);
    expect(url).toContain('saavncdn.com');
    expect(url?.startsWith('/v1/art')).toBe(false);
  });
});

describe('corsArtUrl', () => {
  it('always proxies through /v1/art, even for saavncdn.com sources', () => {
    const url = corsArtUrl('https://c.saavncdn.com/396/cover-150x150.jpg', 64);
    expect(url?.startsWith('/v1/art?')).toBe(true);
    expect(url).toContain('saavncdn.com');
  });

  it('returns undefined for a missing source', () => {
    expect(corsArtUrl(undefined, 64)).toBeUndefined();
    expect(corsArtUrl(null, 64)).toBeUndefined();
  });
});

describe('toEngineUrl prefixing', () => {
  // vitest.config.ts runs this suite under environment: 'node', so localStorage is not a global
  // here (unlike a browser/jsdom environment) — stub it the same way history.test.ts does.
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefixes the art proxy URL with a configured Engine URL', () => {
    localStorage.setItem('naad:engineUrl', 'https://remote-engine.example');
    const url = corsArtUrl('https://c.saavncdn.com/396/cover-150x150.jpg', 64);
    expect(url?.startsWith('https://remote-engine.example/v1/art?')).toBe(true);
    localStorage.removeItem('naad:engineUrl');
  });
});
