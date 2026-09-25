import { createQuery, QueryClient } from '@tanstack/svelte-query';
import { api } from '$lib/api/client';
import { toast } from '$lib/toast.svelte';
import type { Track } from '$lib/types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  },
});

type MaybeAccessor<T> = T | (() => T);

function unwrap<T>(val: MaybeAccessor<T>): T {
  return typeof val === 'function' ? (val as () => T)() : val;
}

export function createHomeQuery() {
  return createQuery(() => ({
    queryKey: ['home'],
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/home');
      if (error) throw error;
      return data;
    },
  }));
}

export function createAlbumQuery(id: MaybeAccessor<string>) {
  return createQuery(() => {
    const albumId = unwrap(id);
    return {
      queryKey: ['album', albumId],
      queryFn: async () => {
        const { data, error } = await api.GET('/v1/albums/{id}', {
          params: { path: { id: albumId } },
        });
        if (error) throw error;
        return data;
      },
      enabled: Boolean(albumId),
    };
  });
}

export function createTrackQuery(id: MaybeAccessor<string>) {
  return createQuery(() => {
    const trackId = unwrap(id);
    return {
      queryKey: ['track', trackId],
      queryFn: async () => {
        const { data, error } = await api.GET('/v1/tracks/{id}', {
          params: { path: { id: trackId } },
        });
        if (error) throw error;
        return data;
      },
      enabled: Boolean(trackId),
    };
  });
}

export function createLyricsQuery(id: MaybeAccessor<string>) {
  return createQuery(() => {
    const trackId = unwrap(id);
    return {
      queryKey: ['lyrics', trackId],
      queryFn: async () => {
        const { data, error } = await api.GET('/v1/tracks/{id}/lyrics', {
          params: { path: { id: trackId } },
        });
        if (error) throw error;
        return data;
      },
      enabled: Boolean(trackId),
    };
  });
}

export function createLikedContainsQuery(ids: MaybeAccessor<string[]>) {
  return createQuery(() => {
    const trackIds = unwrap(ids);
    return {
      queryKey: ['likedContains', trackIds],
      queryFn: async () => {
        if (!trackIds.length) return new Set<string>();
        const { data, error } = await api.GET('/v1/library/tracks/contains', {
          params: { query: { ids: trackIds.join(',') } },
        });
        if (error) throw error;
        const set = new Set<string>();
        trackIds.forEach((id, index) => {
          if (data[index]) set.add(id);
        });
        return set;
      },
      enabled: trackIds.length > 0,
    };
  });
}

export interface SourcesQueryOptions {
  quality?: 'max' | 'hires' | 'lossless' | 'high' | 'standard';
  refresh?: boolean;
}

export function createSourcesQuery(
  id: MaybeAccessor<string>,
  options?: MaybeAccessor<SourcesQueryOptions | undefined>,
) {
  return createQuery(() => {
    const trackId = unwrap(id);
    const opts = unwrap(options);
    return {
      queryKey: ['sources', trackId, opts?.quality, opts?.refresh],
      queryFn: async () => {
        const { data, error } = await api.GET('/v1/tracks/{id}/sources', {
          params: {
            path: { id: trackId },
            query: {
              quality: opts?.quality ?? 'max',
              refresh: opts?.refresh ? 'true' : undefined,
            },
          },
        });
        if (error) throw error;
        return data;
      },
      enabled: Boolean(trackId),
      // Never auto-refetch, keep staleTime safely below the 6-hour token expiry (e.g. 5 hours)
      staleTime: 5 * 60 * 60 * 1000,
      gcTime: 6 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
    };
  });
}

export function createLibraryPlaylistsQuery() {
  return createQuery(() => ({
    queryKey: ['library', 'playlists'],
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/library/playlists');
      if (error) throw error;
      return data.items;
    },
  }));
}

export type SearchType = 'track' | 'album' | 'artist' | 'playlist';

export function createSearchQuery(
  query: MaybeAccessor<string>,
  types?: MaybeAccessor<SearchType[] | undefined>,
  offset?: MaybeAccessor<number | undefined>,
) {
  return createQuery(() => {
    const q = unwrap(query).trim();
    const t = unwrap(types);
    const off = unwrap(offset) ?? 0;
    return {
      queryKey: ['search', q, t, off],
      queryFn: async () => {
        if (!q)
          return { topResult: null, tracks: [], albums: [], artists: [], playlists: [], nextOffset: null };
        const { data, error } = await api.GET('/v1/search', {
          params: {
            query: {
              q,
              types: t?.length ? (t.join(',') as never) : undefined,
              offset: off,
            },
          },
        });
        if (error) throw error;
        return data;
      },
      enabled: q.length > 0,
    };
  });
}

export function createArtistQuery(id: MaybeAccessor<string>) {
  return createQuery(() => {
    const artistId = unwrap(id);
    return {
      queryKey: ['artist', artistId],
      queryFn: async () => {
        const { data, error } = await api.GET('/v1/artists/{id}', {
          params: { path: { id: artistId } },
        });
        if (error) throw error;
        return data;
      },
      enabled: Boolean(artistId),
    };
  });
}

export function createPlaylistQuery(id: MaybeAccessor<string>, cursor?: MaybeAccessor<string | undefined>) {
  return createQuery(() => {
    const playlistId = unwrap(id);
    const cur = unwrap(cursor);
    return {
      queryKey: ['playlist', playlistId, cur],
      queryFn: async () => {
        const { data, error } = await api.GET('/v1/playlists/{id}', {
          params: {
            path: { id: playlistId },
            query: { cursor: cur },
          },
        });
        if (error) throw error;
        return data;
      },
      enabled: Boolean(playlistId),
    };
  });
}

export function createLikedTracksQuery(cursor?: MaybeAccessor<string | undefined>) {
  return createQuery(() => {
    const cur = unwrap(cursor);
    return {
      queryKey: ['library', 'tracks', cur],
      queryFn: async () => {
        const { data, error } = await api.GET('/v1/library/tracks', {
          params: { query: { cursor: cur } },
        });
        if (error) throw error;
        return data;
      },
    };
  });
}

export function createSavedAlbumsQuery(cursor?: MaybeAccessor<string | undefined>) {
  return createQuery(() => {
    const cur = unwrap(cursor);
    return {
      queryKey: ['library', 'albums', cur],
      queryFn: async () => {
        const { data, error } = await api.GET('/v1/library/albums', {
          params: { query: { cursor: cur } },
        });
        if (error) throw error;
        return data;
      },
    };
  });
}

export function createFollowedArtistsQuery(cursor?: MaybeAccessor<string | undefined>) {
  return createQuery(() => {
    const cur = unwrap(cursor);
    return {
      queryKey: ['library', 'artists', cur],
      queryFn: async () => {
        const { data, error } = await api.GET('/v1/library/artists', {
          params: { query: { cursor: cur } },
        });
        if (error) throw error;
        return data;
      },
    };
  });
}

export function createHistoryQuery(cursor?: MaybeAccessor<string | undefined>) {
  return createQuery(() => {
    const cur = unwrap(cursor);
    return {
      queryKey: ['library', 'history', cur],
      queryFn: async () => {
        const { data, error } = await api.GET('/v1/history', {
          params: { query: { cursor: cur } },
        });
        if (error) throw error;
        return data;
      },
    };
  });
}

export async function fetchRadioTracks(seed: string, limit = 25, exclude?: string[]) {
  const { data, error } = await api.GET('/v1/radio', {
    params: {
      query: {
        seed,
        limit,
        exclude: exclude?.length ? exclude.join(',') : undefined,
      },
    },
  });
  if (error) throw error;
  return data.tracks;
}

export function createImportStatusQuery(id: MaybeAccessor<string | undefined>) {
  return createQuery(() => {
    const importId = unwrap(id);
    return {
      queryKey: ['import', importId],
      queryFn: async () => {
        if (!importId) return null;
        const { data, error } = await api.GET('/v1/imports/{id}', {
          params: { path: { id: importId } },
        });
        if (error) throw error;
        return data;
      },
      enabled: Boolean(importId),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === 'completed' || status === 'failed') return false;
        return 1500;
      },
    };
  });
}

/**
 * Toggles a track's liked status via PUT /v1/library/tracks or DELETE /v1/library/tracks,
 * invalidating relevant queries and displaying a notification.
 */
export async function toggleLikeTrack(track: Track, isLiked: boolean): Promise<boolean> {
  try {
    if (isLiked) {
      const { error } = await api.DELETE('/v1/library/tracks', {
        body: { trackIds: [track.id] },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['library', 'tracks'] });
      queryClient.invalidateQueries({ queryKey: ['likedContains'] });
      toast.push(`Removed "${track.title}" from Liked Songs`);
      return false;
    } else {
      const { error } = await api.PUT('/v1/library/tracks', {
        body: { trackIds: [track.id] },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['library', 'tracks'] });
      queryClient.invalidateQueries({ queryKey: ['likedContains'] });
      toast.push(`Added "${track.title}" to Liked Songs`);
      return true;
    }
  } catch (err) {
    console.warn('[toggleLikeTrack] error:', err);
    toast.push('Could not update Liked Songs', { tone: 'danger' });
    throw err;
  }
}
