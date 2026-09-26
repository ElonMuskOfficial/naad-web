import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/api/client', () => ({ api: { GET: vi.fn() } }));

import { api } from '$lib/api/client';
import type { Track } from '$lib/types';
import { appendSearchPage, emptySearchExtra, fetchSearchPage, mergeSearchResults } from './search';

const get = (api as unknown as { GET: ReturnType<typeof vi.fn> }).GET;
const t = (id: string) => ({ id, title: `T${id}` }) as unknown as Track;
const first = (over: Record<string, unknown> = {}) => ({
  topResult: null,
  tracks: [t('1'), t('2')],
  albums: [],
  artists: [],
  playlists: [],
  nextOffset: 2 as number | null,
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('mergeSearchResults', () => {
  it('returns the first page untouched when nothing more was loaded', () => {
    const page = first();
    expect(mergeSearchResults(page, emptySearchExtra())).toEqual(page);
  });

  it('appends the extra pages and takes the next offset from the last one', () => {
    const extra = { ...emptySearchExtra(), tracks: [t('3'), t('4')], nextOffset: 4 as number | null };
    const merged = mergeSearchResults(first(), extra);
    expect(merged.tracks.map((x) => x.id)).toEqual(['1', '2', '3', '4']);
    expect(merged.nextOffset).toBe(4);
  });

  it('knows when the end was reached', () => {
    const extra = { ...emptySearchExtra(), tracks: [t('3')], nextOffset: null as number | null };
    expect(mergeSearchResults(first(), extra).nextOffset).toBeNull();
  });

  it('never shows the same item twice when pages overlap', () => {
    const extra = { ...emptySearchExtra(), tracks: [t('2'), t('3')], nextOffset: 4 as number | null };
    expect(mergeSearchResults(first(), extra).tracks.map((x) => x.id)).toEqual(['1', '2', '3']);
  });

  it('keeps the top result and does not mutate its inputs', () => {
    const page = first({ topResult: { type: 'track', item: t('1') } });
    const extra = { ...emptySearchExtra(), tracks: [t('3')], nextOffset: 3 as number | null };
    const merged = mergeSearchResults(page, extra);
    expect(merged.topResult).toEqual(page.topResult);
    expect(page.tracks).toHaveLength(2);
    expect(extra.tracks).toHaveLength(1);
  });
});

describe('appendSearchPage', () => {
  it('accumulates pages of every kind and remembers the latest next offset', () => {
    const a = appendSearchPage(emptySearchExtra(), {
      ...emptySearchExtra(),
      tracks: [t('3')],
      nextOffset: 3,
    });
    const b = appendSearchPage(a, { ...emptySearchExtra(), tracks: [t('4')], nextOffset: null });
    expect(b.tracks.map((x) => x.id)).toEqual(['3', '4']);
    expect(b.nextOffset).toBeNull();
  });
});

describe('fetchSearchPage', () => {
  it('asks naad for the next page of one type at the given offset', async () => {
    get.mockResolvedValue({ data: { ...first(), tracks: [t('3')], nextOffset: 22 } });
    const page = await fetchSearchPage('arijit', 'track', 20);
    expect(get).toHaveBeenCalledWith('/v1/search', {
      params: { query: { q: 'arijit', types: 'track', offset: 20 } },
    });
    expect(page.tracks.map((x) => x.id)).toEqual(['3']);
    expect(page.nextOffset).toBe(22);
  });

  it('lets a failure reach the caller', async () => {
    get.mockRejectedValue(new Error('503'));
    await expect(fetchSearchPage('x', 'album', 20)).rejects.toThrow('503');
  });
});
