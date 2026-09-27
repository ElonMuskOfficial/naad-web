import { describe, expect, it } from 'vitest';
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
