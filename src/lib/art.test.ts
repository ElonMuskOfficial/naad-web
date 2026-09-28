import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { artUrl } from './art';

describe('artUrl', () => {
  it('returns a saavncdn.com URL directly for plain display (no CORS needed)', () => {
    const url = artUrl('https://c.saavncdn.com/396/cover-150x150.jpg', 150);
    expect(url).toContain('saavncdn.com');
    expect(url?.startsWith('/v1/art')).toBe(false);
  });
});

// `corsArtUrl` always prefixes with the build-configured Engine URL (via toEngineUrl), so every test
// here pins that env var explicitly rather than relying on whatever a developer's local .env happens
// to set — vi.resetModules() + a dynamic import gets a fresh read of import.meta.env per test.
describe('corsArtUrl', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('always proxies through /v1/art, even for saavncdn.com sources, when no Engine URL is configured', async () => {
    vi.stubEnv('VITE_NAAD_ENGINE_URL', '');
    const { corsArtUrl } = await import('./art');

    const url = corsArtUrl('https://c.saavncdn.com/396/cover-150x150.jpg', 64);
    expect(url?.startsWith('/v1/art?')).toBe(true);
    expect(url).toContain('saavncdn.com');
  });

  it('returns undefined for a missing source', async () => {
    vi.stubEnv('VITE_NAAD_ENGINE_URL', '');
    const { corsArtUrl } = await import('./art');

    expect(corsArtUrl(undefined, 64)).toBeUndefined();
    expect(corsArtUrl(null, 64)).toBeUndefined();
  });

  it('prefixes the art proxy URL with the build-configured Engine URL', async () => {
    vi.stubEnv('VITE_NAAD_ENGINE_URL', 'https://remote-engine.example');
    const { corsArtUrl } = await import('./art');

    const url = corsArtUrl('https://c.saavncdn.com/396/cover-150x150.jpg', 64);
    expect(url?.startsWith('https://remote-engine.example/v1/art?')).toBe(true);
  });
});
