import { api } from '$lib/api/client';
import type { Album, Artist, Playlist, Track } from '$lib/types';

/**
 * "Load more" for the typed search tabs. naad answers a search one page at a time and says where the next page
 * starts (`nextOffset`, null at the end). The first page comes from the search query; further pages are kept
 * beside it as a `SearchExtra` and merged in, so the page keeps reading one `searchResults` value.
 */
export interface SearchLists {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  nextOffset: number | null;
}

/** Pages loaded after the first one. `nextOffset` is undefined until one was loaded. */
export interface SearchExtra {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  nextOffset?: number | null;
}

export const emptySearchExtra = (): SearchExtra => ({ tracks: [], albums: [], artists: [], playlists: [] });

const withoutDuplicates = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

/** The first page plus every extra page (no item twice); the next offset is the latest one known. */
export function mergeSearchResults<T extends SearchLists>(first: T, extra: SearchExtra): T {
  return {
    ...first,
    tracks: withoutDuplicates([...first.tracks, ...extra.tracks]),
    albums: withoutDuplicates([...first.albums, ...extra.albums]),
    artists: withoutDuplicates([...first.artists, ...extra.artists]),
    playlists: withoutDuplicates([...first.playlists, ...extra.playlists]),
    nextOffset: extra.nextOffset === undefined ? first.nextOffset : extra.nextOffset,
  };
}

/** Adds one freshly loaded page to what was loaded before. */
export function appendSearchPage(extra: SearchExtra, page: SearchExtra): SearchExtra {
  return {
    tracks: [...extra.tracks, ...page.tracks],
    albums: [...extra.albums, ...page.albums],
    artists: [...extra.artists, ...page.artists],
    playlists: [...extra.playlists, ...page.playlists],
    nextOffset: page.nextOffset,
  };
}

/** One further page of a single result type, starting at `offset`. */
export async function fetchSearchPage(
  q: string,
  type: 'track' | 'album' | 'artist' | 'playlist',
  offset: number,
): Promise<SearchExtra> {
  const { data, error } = await api.GET('/v1/search', {
    params: { query: { q, types: type as never, offset } },
  });
  if (error) throw error;
  return {
    tracks: data?.tracks ?? [],
    albums: data?.albums ?? [],
    artists: data?.artists ?? [],
    playlists: data?.playlists ?? [],
    nextOffset: data?.nextOffset ?? null,
  };
}
