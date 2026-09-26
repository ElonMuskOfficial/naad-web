import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/api/client', () => ({ api: { GET: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() } }));
vi.mock('$lib/toast.svelte', () => ({ toast: { push: vi.fn() } }));

import { api } from '$lib/api/client';
import { toast } from '$lib/toast.svelte';
import type { Track } from '$lib/types';
import {
  fetchLikedSet,
  queryClient,
  toggleFollowArtist,
  toggleLikeCurrent,
  toggleSaveAlbum,
  userPlaylists,
} from './index';

const mocked = api as unknown as Record<'GET' | 'PUT' | 'DELETE', ReturnType<typeof vi.fn>>;
const track = { id: 'trk1', title: 'Kesariya' } as Track;

beforeEach(() => {
  vi.clearAllMocks();
  mocked.GET.mockResolvedValue({ data: [false] });
  mocked.PUT.mockResolvedValue({});
  mocked.DELETE.mockResolvedValue({});
  vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
});

describe('toggleFollowArtist', () => {
  it('follows, refreshes the followed list and says so', async () => {
    expect(await toggleFollowArtist('art1', 'Arijit Singh', false)).toBe(true);
    expect(mocked.PUT).toHaveBeenCalledWith('/v1/library/artists/{id}', { params: { path: { id: 'art1' } } });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['library', 'artists'] });
    expect(toast.push).toHaveBeenCalledWith('Followed Arijit Singh');
  });

  it('unfollows the same way', async () => {
    expect(await toggleFollowArtist('art1', 'Arijit Singh', true)).toBe(false);
    expect(mocked.DELETE).toHaveBeenCalledWith('/v1/library/artists/{id}', {
      params: { path: { id: 'art1' } },
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['library', 'artists'] });
    expect(toast.push).toHaveBeenCalledWith('Unfollowed Arijit Singh');
  });

  it('reports a failure, changes nothing in the cache and lets the caller revert', async () => {
    mocked.PUT.mockRejectedValue(new Error('503'));
    await expect(toggleFollowArtist('art1', 'A', false)).rejects.toThrow('503');
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
    expect(toast.push).toHaveBeenCalledWith('Failed to update follow status', { tone: 'danger' });
  });
});

describe('toggleSaveAlbum', () => {
  it('saves an album for real and refreshes the saved albums', async () => {
    expect(await toggleSaveAlbum('alb1', 'Brahmastra', false)).toBe(true);
    expect(mocked.PUT).toHaveBeenCalledWith('/v1/library/albums/{id}', { params: { path: { id: 'alb1' } } });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['library', 'albums'] });
    expect(toast.push).toHaveBeenCalledWith('Saved "Brahmastra" to library');
  });

  it('removes it again', async () => {
    expect(await toggleSaveAlbum('alb1', 'Brahmastra', true)).toBe(false);
    expect(mocked.DELETE).toHaveBeenCalledWith('/v1/library/albums/{id}', {
      params: { path: { id: 'alb1' } },
    });
    expect(toast.push).toHaveBeenCalledWith('Removed "Brahmastra" from library');
  });

  it('reports a failure instead of pretending it saved', async () => {
    mocked.PUT.mockRejectedValue(new Error('503'));
    await expect(toggleSaveAlbum('alb1', 'B', false)).rejects.toThrow('503');
    expect(toast.push).toHaveBeenCalledWith('Could not update your library', { tone: 'danger' });
  });
});

describe('toggleLikeCurrent (the L shortcut)', () => {
  it('likes a track that is not liked yet', async () => {
    mocked.GET.mockResolvedValue({ data: [false] });
    expect(await toggleLikeCurrent(track)).toBe(true);
    expect(mocked.GET).toHaveBeenCalledWith('/v1/library/tracks/contains', {
      params: { query: { ids: 'trk1' } },
    });
    expect(mocked.PUT).toHaveBeenCalledWith('/v1/library/tracks', { body: { trackIds: ['trk1'] } });
  });

  it('unlikes a track that is already liked, instead of liking it again', async () => {
    mocked.GET.mockResolvedValue({ data: [true] });
    expect(await toggleLikeCurrent(track)).toBe(false);
    expect(mocked.DELETE).toHaveBeenCalledWith('/v1/library/tracks', { body: { trackIds: ['trk1'] } });
    expect(mocked.PUT).not.toHaveBeenCalled();
  });

  it('does not guess when it cannot tell whether the track is liked', async () => {
    mocked.GET.mockRejectedValue(new Error('503'));
    await expect(toggleLikeCurrent(track)).rejects.toThrow('503');
    expect(mocked.PUT).not.toHaveBeenCalled();
    expect(mocked.DELETE).not.toHaveBeenCalled();
    expect(toast.push).toHaveBeenCalledWith('Could not update Liked Songs', { tone: 'danger' });
  });
});

describe('userPlaylists', () => {
  it('keeps only the playlists the user can add to (naad accepts additions to its own playlists only)', () => {
    const list = [
      { id: 'usr_1', origin: 'user' },
      { id: '1234', origin: 'external' },
      { id: 'usr_2', origin: 'user' },
    ] as never[];
    expect(userPlaylists(list).map((p: { id: string }) => p.id)).toEqual(['usr_1', 'usr_2']);
  });
});

describe('fetchLikedSet', () => {
  const idsOf = (n: number) => Array.from({ length: n }, (_, i) => `id${i}`);

  it('never asks for more than 100 ids at a time and merges the answers', async () => {
    mocked.GET.mockImplementation(async (_path: string, opts: { params: { query: { ids: string } } }) => ({
      data: opts.params.query.ids.split(',').map((id) => Number(id.slice(2)) % 2 === 0),
    }));
    const liked = await fetchLikedSet(idsOf(250));
    const sizes = mocked.GET.mock.calls.map(
      (c) => (c[1] as { params: { query: { ids: string } } }).params.query.ids.split(',').length,
    );
    expect(sizes).toEqual([100, 100, 50]);
    expect(liked.size).toBe(125);
    expect(liked.has('id0')).toBe(true);
    expect(liked.has('id1')).toBe(false);
    expect(liked.has('id248')).toBe(true);
  });

  it('asks once for a short list and not at all for an empty one', async () => {
    mocked.GET.mockResolvedValue({ data: [true, false] });
    expect([...(await fetchLikedSet(['a', 'b']))]).toEqual(['a']);
    expect(mocked.GET).toHaveBeenCalledTimes(1);
    mocked.GET.mockClear();
    expect((await fetchLikedSet([])).size).toBe(0);
    expect(mocked.GET).not.toHaveBeenCalled();
  });
});

describe('the library lists are refreshed before a toggle finishes', () => {
  it('toggleSaveAlbum resolves only after the saved albums were invalidated', async () => {
    let release: () => void = () => {};
    vi.mocked(queryClient.invalidateQueries).mockReturnValue(new Promise<void>((r) => (release = r)));
    let done = false;
    const pending = toggleSaveAlbum('alb1', 'B', false).then(() => {
      done = true;
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(done).toBe(false);
    release();
    await pending;
    expect(done).toBe(true);
  });

  it('toggleFollowArtist resolves only after the followed artists were invalidated', async () => {
    let release: () => void = () => {};
    vi.mocked(queryClient.invalidateQueries).mockReturnValue(new Promise<void>((r) => (release = r)));
    let done = false;
    const pending = toggleFollowArtist('art1', 'A', false).then(() => {
      done = true;
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(done).toBe(false);
    release();
    await pending;
    expect(done).toBe(true);
  });
});
