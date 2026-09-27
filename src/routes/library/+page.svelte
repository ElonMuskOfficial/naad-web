<script lang="ts">
import { page } from '$app/state';
import { goto } from '$app/navigation';
import { api } from '$lib/api/client';
import { formatDurationMs, joinArtists } from '$lib/format';
import { Play, Shuffle } from '$lib/icons';
import { player } from '$lib/player/engine.svelte';
import {
  createFollowedArtistsQuery,
  createHistoryQuery,
  createLibraryPlaylistsQuery,
  createLikedTracksQuery,
  createSavedAlbumsQuery,
  playAlbumById,
  playPlaylistById,
  queryClient,
  toggleLikeTrack,
} from '$lib/queries';
import { toast } from '$lib/toast.svelte';
import type { Track } from '$lib/types';
import Artwork from '$lib/ui/Artwork.svelte';
import Button from '$lib/ui/Button.svelte';
import EmptyState from '$lib/ui/EmptyState.svelte';
import MediaCard from '$lib/ui/MediaCard.svelte';
import Skeleton from '$lib/ui/Skeleton.svelte';
import TrackTable from '$lib/ui/TrackTable.svelte';
import Clock from 'phosphor-svelte/lib/Clock';
import Disc from 'phosphor-svelte/lib/Disc';
import Heart from 'phosphor-svelte/lib/Heart';
import PlaylistIcon from 'phosphor-svelte/lib/Playlist';
import Plus from 'phosphor-svelte/lib/Plus';
import User from 'phosphor-svelte/lib/User';
import X from 'phosphor-svelte/lib/X';

type LibraryTab = 'playlists' | 'tracks' | 'albums' | 'artists' | 'history';

let activeTab = $state<LibraryTab>((page.url.searchParams.get('tab') as LibraryTab) || 'playlists');

$effect(() => {
  const queryTab = page.url.searchParams.get('tab') as LibraryTab | null;
  if (queryTab && ['playlists', 'tracks', 'albums', 'artists', 'history'].includes(queryTab)) {
    activeTab = queryTab;
  }
});

function switchTab(tab: LibraryTab) {
  activeTab = tab;
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState({}, '', url.toString());
}

// Queries
const playlistsQuery = createLibraryPlaylistsQuery();
const likedTracksQuery = createLikedTracksQuery();
const savedAlbumsQuery = createSavedAlbumsQuery();
const followedArtistsQuery = createFollowedArtistsQuery();
const historyQuery = createHistoryQuery();

// Create playlist modal
let isCreatingPlaylist = $state(false);
let newTitle = $state('');
let newDescription = $state('');

async function handleCreatePlaylist(e: Event) {
  e.preventDefault();
  if (!newTitle.trim()) return;
  try {
    const { data, error } = await api.POST('/v1/playlists', {
      body: { title: newTitle.trim(), description: newDescription.trim() || undefined },
    });
    if (error) throw error;
    isCreatingPlaylist = false;
    newTitle = '';
    newDescription = '';
    queryClient.invalidateQueries({ queryKey: ['library', 'playlists'] });
    toast.push('Playlist created');
    if (data?.id) {
      goto(`/playlist/${data.id}`);
    }
  } catch (err) {
    toast.push('Failed to create playlist', { tone: 'danger' });
  }
}

// Liked tracks list
const likedTracks = $derived(likedTracksQuery.data?.items?.map((it) => it.track) ?? []);
const likedIds = $derived(new Set(likedTracks.map((t) => t.id)));

function playAllLiked() {
  if (likedTracks.length > 0) {
    player.playTrack(likedTracks[0]!, likedTracks, { type: 'library', id: 'tracks' });
  }
}

function shuffleAllLiked() {
  if (likedTracks.length > 0) {
    const shuffled = [...likedTracks].sort(() => Math.random() - 0.5);
    player.shuffle = true;
    player.playTrack(shuffled[0]!, shuffled, { type: 'library', id: 'tracks' });
  }
}

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoString).toLocaleDateString();
  } catch {
    return 'Recently';
  }
}
</script>

<svelte:head>
  <title>Your Library — NAAD</title>
</svelte:head>

<div class="px-4 py-6 sm:px-6 sm:py-8 max-w-7xl mx-auto flex flex-col gap-6">
  <!-- Header Bar -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
    <div>
      <h1 class="font-display text-3xl sm:text-4xl text-ink font-normal leading-tight">Your Library</h1>
      <p class="text-xs sm:text-sm text-ink-muted mt-1">Playlists, saved tracks, albums, and artists in your personal catalog.</p>
    </div>

    <!-- Create Playlist Action Button -->
    <div class="flex items-center gap-2">
      <Button variant="solid" onclick={() => (isCreatingPlaylist = true)}>
        <Plus size={16} weight="bold" />
        <span>New Playlist</span>
      </Button>
    </div>
  </div>

  <!-- Create Playlist Modal / Overlay -->
  {#if isCreatingPlaylist}
    <div class="p-5 rounded-sm border border-accent bg-surface-1 flex flex-col gap-4 max-w-md">
      <div class="flex items-center justify-between">
        <h3 class="font-display text-lg text-ink font-normal">Create New Playlist</h3>
        <button
          type="button"
          onclick={() => (isCreatingPlaylist = false)}
          class="text-ink-muted hover:text-ink p-1 rounded-xs transition-colors"
          aria-label="Close"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
      <form onsubmit={handleCreatePlaylist} class="flex flex-col gap-3">
        <div>
          <label for="pl-title" class="font-mono text-2xs uppercase tracking-wider text-ink-faint block mb-1">
            Title
          </label>
          <input
            id="pl-title"
            type="text"
            bind:value={newTitle}
            placeholder="e.g. Evening Ragas, Late Night Focus"
            class="w-full h-10 px-3 rounded-xs bg-surface-2 border border-border text-ink text-sm focus:outline-none focus:border-accent"
            required
          />
        </div>
        <div>
          <label for="pl-desc" class="font-mono text-2xs uppercase tracking-wider text-ink-faint block mb-1">
            Description (Optional)
          </label>
          <textarea
            id="pl-desc"
            bind:value={newDescription}
            rows="2"
            placeholder="Add context or notes"
            class="w-full px-3 py-2 rounded-xs bg-surface-2 border border-border text-ink text-xs focus:outline-none focus:border-accent resize-none"
          ></textarea>
        </div>
        <div class="flex items-center justify-end gap-2 mt-1">
          <Button variant="ghost" onclick={() => (isCreatingPlaylist = false)}>Cancel</Button>
          <Button variant="solid" type="submit">Create</Button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Section Navigation Tabs -->
  <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-border text-xs sm:text-sm">
    <button
      type="button"
      onclick={() => switchTab('playlists')}
      class="px-3.5 py-1.5 rounded-xs transition-colors shrink-0 {activeTab === 'playlists' ? 'bg-surface-2 text-ink font-medium border-b-2 border-accent' : 'text-ink-muted hover:text-ink hover:bg-surface-1'}"
    >
      Playlists
    </button>
    <button
      type="button"
      onclick={() => switchTab('tracks')}
      class="px-3.5 py-1.5 rounded-xs transition-colors shrink-0 {activeTab === 'tracks' ? 'bg-surface-2 text-ink font-medium border-b-2 border-accent' : 'text-ink-muted hover:text-ink hover:bg-surface-1'}"
    >
      Liked Songs
    </button>
    <button
      type="button"
      onclick={() => switchTab('albums')}
      class="px-3.5 py-1.5 rounded-xs transition-colors shrink-0 {activeTab === 'albums' ? 'bg-surface-2 text-ink font-medium border-b-2 border-accent' : 'text-ink-muted hover:text-ink hover:bg-surface-1'}"
    >
      Saved Albums
    </button>
    <button
      type="button"
      onclick={() => switchTab('artists')}
      class="px-3.5 py-1.5 rounded-xs transition-colors shrink-0 {activeTab === 'artists' ? 'bg-surface-2 text-ink font-medium border-b-2 border-accent' : 'text-ink-muted hover:text-ink hover:bg-surface-1'}"
    >
      Followed Artists
    </button>
    <button
      type="button"
      onclick={() => switchTab('history')}
      class="px-3.5 py-1.5 rounded-xs transition-colors shrink-0 {activeTab === 'history' ? 'bg-surface-2 text-ink font-medium border-b-2 border-accent' : 'text-ink-muted hover:text-ink hover:bg-surface-1'}"
    >
      History
    </button>
  </div>

  <!-- Tab Content Sections -->
  {#if activeTab === 'playlists'}
    <!-- Playlists Tab View -->
    {#if playlistsQuery.isPending}
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {#each Array(6) as _}
          <div class="flex flex-col gap-2">
            <Skeleton class="aspect-square w-full rounded-sm" />
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-1/2" />
          </div>
        {/each}
      </div>
    {:else if !playlistsQuery.data || playlistsQuery.data.length === 0}
      <EmptyState
        title="No playlists yet"
        description="Create your first playlist to organize songs, albums, and moods in one place."
      />
    {:else}
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <!-- New playlist dashed tile -->
        <button
          type="button"
          onclick={() => (isCreatingPlaylist = true)}
          class="aspect-square w-full rounded-xs border-2 border-dashed border-border hover:border-accent hover:bg-surface-1 transition-all flex flex-col items-center justify-center gap-2 text-ink-muted hover:text-ink group"
        >
          <div class="size-10 rounded-full bg-surface-2 group-hover:bg-surface-3 flex items-center justify-center transition-colors">
            <Plus size={20} weight="bold" />
          </div>
          <span class="text-xs font-medium">New Playlist</span>
        </button>

        {#each playlistsQuery.data as playlist (playlist.id)}
          <MediaCard
            title={playlist.title}
            subtitle={`${playlist.trackCount} ${playlist.trackCount === 1 ? 'track' : 'tracks'} · ${playlist.origin === 'user' ? 'Library' : 'JioSaavn'}`}
            image={playlist.images?.[0]?.url}
            href={`/playlist/${playlist.id}`}
            onplay={() => playPlaylistById(playlist.id)}
          />
        {/each}
      </div>
    {/if}
  {:else if activeTab === 'tracks'}
    <!-- Liked Songs Tab View -->
    {#if likedTracksQuery.isPending}
      <div class="flex flex-col gap-2">
        {#each Array(8) as _}
          <Skeleton class="h-11 w-full rounded-xs" />
        {/each}
      </div>
    {:else if likedTracks.length === 0}
      <EmptyState
        title="No liked songs yet"
        description="Tap the heart icon on any track to save it to your Liked Songs collection."
      />
    {:else}
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint">
              {likedTracks.length} {likedTracks.length === 1 ? 'song' : 'songs'}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="solid" onclick={playAllLiked}>
              <Play size={16} />
              <span>Play</span>
            </Button>
            <Button variant="outline" onclick={shuffleAllLiked}>
              <Shuffle size={16} />
              <span>Shuffle</span>
            </Button>
          </div>
        </div>

        <TrackTable
          tracks={likedTracks}
          showArtwork={true}
          showAlbum={true}
          {likedIds}
          currentId={player.currentTrack?.id}
          playing={player.status === 'playing'}
          onplay={(t) => player.playTrack(t, likedTracks, { type: 'library', id: 'tracks' })}
          onlike={(t) => toggleLikeTrack(t, true)}
        />
      </div>
    {/if}
  {:else if activeTab === 'albums'}
    <!-- Saved Albums Tab View -->
    {#if savedAlbumsQuery.isPending}
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {#each Array(6) as _}
          <div class="flex flex-col gap-2">
            <Skeleton class="aspect-square w-full rounded-sm" />
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-1/2" />
          </div>
        {/each}
      </div>
    {:else if !savedAlbumsQuery.data?.items || savedAlbumsQuery.data.items.length === 0}
      <EmptyState
        title="No saved albums"
        description="When you find albums you love, save them to access your collection here."
      />
    {:else}
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {#each savedAlbumsQuery.data.items as item (item.album.id)}
          <MediaCard
            title={item.album.title}
            subtitle={item.album.artists.map((a) => a.name).join(', ')}
            image={item.album.images?.[0]?.url}
            href={`/album/${item.album.id}`}
            onplay={() => playAlbumById(item.album.id)}
          />
        {/each}
      </div>
    {/if}
  {:else if activeTab === 'artists'}
    <!-- Followed Artists Tab View -->
    {#if followedArtistsQuery.isPending}
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {#each Array(6) as _}
          <div class="flex flex-col items-center gap-2">
            <Skeleton class="aspect-square w-full rounded-full" />
            <Skeleton class="h-4 w-3/4" />
          </div>
        {/each}
      </div>
    {:else if !followedArtistsQuery.data?.items || followedArtistsQuery.data.items.length === 0}
      <EmptyState
        title="No followed artists"
        description="Follow artists to easily access their discography and stay updated with new releases."
      />
    {:else}
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {#each followedArtistsQuery.data.items as item (item.artist.id)}
          <MediaCard
            title={item.artist.name}
            subtitle="Artist"
            image={item.artist.images?.[0]?.url}
            href={`/artist/${item.artist.id}`}
            shape="circle"
          />
        {/each}
      </div>
    {/if}
  {:else if activeTab === 'history'}
    <!-- Listening History View -->
    {#if historyQuery.isPending}
      <div class="flex flex-col gap-2">
        {#each Array(8) as _}
          <Skeleton class="h-12 w-full rounded-xs" />
        {/each}
      </div>
    {:else if !historyQuery.data?.items || historyQuery.data.items.length === 0}
      <EmptyState
        title="No listening history"
        description="Your recently played tracks and listening sessions will appear here."
      />
    {:else}
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between pb-2 border-b border-border">
          <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Recently Played</span>
          <span class="font-mono text-2xs text-ink-faint">{historyQuery.data.items.length} sessions</span>
        </div>

        <div class="flex flex-col divide-y divide-border/30">
          {#each historyQuery.data.items as record, idx (record.playedAt + idx)}
            {@const isCurrent = player.currentTrack?.id === record.track.id}
            <div
              class="group flex items-center justify-between p-2 rounded-xs hover:bg-surface-1 transition-colors"
              class:bg-surface-2={isCurrent}
            >
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onclick={() => player.playTrack(record.track)}
                  class="relative size-10 shrink-0 rounded-xs overflow-hidden bg-surface-2 group-hover:opacity-90"
                  aria-label={`Play ${record.track.title}`}
                >
                  <Artwork
                    src={record.track.images?.[0]?.url ?? record.track.album?.images?.[0]?.url}
                    alt=""
                    size={40}
                  />
                  <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <Play size={16} />
                  </div>
                </button>

                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium" class:text-accent={isCurrent} class:text-ink={!isCurrent}>
                    {record.track.title}
                  </p>
                  <p class="truncate text-xs text-ink-muted mt-0.5">
                    {joinArtists(record.track.artists.map((a) => a.name))}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-4 pl-3 shrink-0">
                <span class="font-mono text-xs text-ink-muted" title={record.playedAt}>
                  {formatRelativeTime(record.playedAt)}
                </span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>
