<script lang="ts">
import { page } from '$app/state';
import { goto, replaceState } from '$app/navigation';
import { bestImageUrl } from '$lib/art';
import {
  createLikedContainsQuery,
  createSearchQuery,
  playAlbumById,
  playPlaylistById,
  toggleLikeTrack,
  type SearchType,
} from '$lib/queries';
import { player } from '$lib/player/engine.svelte';
import {
  appendSearchPage,
  emptySearchExtra,
  fetchSearchPage,
  mergeSearchResults,
  type SearchExtra,
} from '$lib/queries/search';
import { toast } from '$lib/toast.svelte';
import Button from '$lib/ui/Button.svelte';
import type { Album, Artist, Playlist, Track } from '$lib/types';
import Artwork from '$lib/ui/Artwork.svelte';
import EmptyState from '$lib/ui/EmptyState.svelte';
import MediaCard from '$lib/ui/MediaCard.svelte';
import Skeleton from '$lib/ui/Skeleton.svelte';
import TrackTable from '$lib/ui/TrackTable.svelte';
import { Play } from '$lib/icons';
import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
import X from 'phosphor-svelte/lib/X';

type ActiveTab = 'all' | 'tracks' | 'albums' | 'artists' | 'playlists';

let queryInput = $state(page.url.searchParams.get('q') ?? '');
let debouncedQuery = $state(page.url.searchParams.get('q') ?? '');
let activeTab = $state<ActiveTab>((page.url.searchParams.get('type') as ActiveTab) || 'all');
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function handleInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  queryInput = val;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debouncedQuery = val.trim();
    const url = new URL(window.location.href);
    if (debouncedQuery) {
      url.searchParams.set('q', debouncedQuery);
    } else {
      url.searchParams.delete('q');
    }
    replaceState(url.toString(), {});
  }, 250);
}

function clearQuery() {
  queryInput = '';
  debouncedQuery = '';
  clearTimeout(debounceTimer);
  const url = new URL(window.location.href);
  url.searchParams.delete('q');
  replaceState(url.toString(), {});
}

function setTab(tab: ActiveTab) {
  activeTab = tab;
  const url = new URL(window.location.href);
  if (tab !== 'all') {
    url.searchParams.set('type', tab);
  } else {
    url.searchParams.delete('type');
  }
  replaceState(url.toString(), {});
}

const requestedTypes = $derived.by<SearchType[] | undefined>(() => {
  if (activeTab === 'all') return undefined;
  if (activeTab === 'tracks') return ['track'];
  if (activeTab === 'albums') return ['album'];
  if (activeTab === 'artists') return ['artist'];
  if (activeTab === 'playlists') return ['playlist'];
  return undefined;
});

const searchQuery = createSearchQuery(
  () => debouncedQuery,
  () => requestedTypes,
);

// "Load more" on the typed tabs: pages after the first are kept here and merged into what the page shows.
let extra = $state<SearchExtra>(emptySearchExtra());
let loadingMore = $state(false);
$effect(() => {
  // a new query or another tab starts again from the first page
  void debouncedQuery;
  void activeTab;
  extra = emptySearchExtra();
});

const searchResults = $derived(
  searchQuery.data ? mergeSearchResults(searchQuery.data, extra) : searchQuery.data,
);

async function loadMore() {
  const type = requestedTypes?.[0];
  const offset = searchResults?.nextOffset;
  if (!type || offset == null || loadingMore) return;
  loadingMore = true;
  const forQuery = debouncedQuery;
  const forTab = activeTab;
  try {
    const page = await fetchSearchPage(forQuery, type, offset);
    // the user may have searched for something else while this was loading
    if (forQuery === debouncedQuery && forTab === activeTab) extra = appendSearchPage(extra, page);
  } catch {
    toast.push('Could not load more results', { tone: 'danger' });
  } finally {
    loadingMore = false;
  }
}

// Track liked status for all displayed tracks
const displayedTrackIds = $derived.by(() => {
  const ids: string[] = [];
  if (searchResults?.topResult?.type === 'track') {
    ids.push(searchResults.topResult.item.id);
  }
  for (const t of searchResults?.tracks ?? []) {
    ids.push(t.id);
  }
  return ids;
});

const likedQuery = createLikedContainsQuery(() => displayedTrackIds);
const likedIds = $derived(likedQuery.data ?? new Set<string>());

// Search results are a flat, unordered grab-bag of hits, not a real collection like an album or playlist —
// JioSaavn itself only ever queues the one clicked song here, never the rest of the visible results.
function playTrack(track: Track) {
  player.playTrack(track, [track]);
}

function handleTopResultClick() {
  const top = searchResults?.topResult;
  if (!top) return;
  if (top.type === 'track') {
    playTrack(top.item);
  } else if (top.type === 'album') {
    goto(`/album/${top.item.id}`);
  } else if (top.type === 'artist') {
    goto(`/artist/${top.item.id}`);
  }
}
</script>

{#snippet loadMoreButton()}
  {#if searchResults && searchResults.nextOffset !== null}
    <div class="flex justify-center pt-2">
      <Button variant="outline" onclick={loadMore} disabled={loadingMore}>
        {loadingMore ? 'Loading…' : 'Load more'}
      </Button>
    </div>
  {/if}
{/snippet}

<svelte:head>
  <title>{debouncedQuery ? `Search: "${debouncedQuery}" — NAAD` : 'Search — NAAD'}</title>
</svelte:head>

<div class="px-4 py-6 sm:px-6 sm:py-8 max-w-7xl mx-auto flex flex-col gap-6">
  <!-- Search Header Bar -->
  <div class="flex flex-col gap-4">
    <div class="relative flex items-center w-full max-w-2xl">
      <div class="absolute left-3.5 flex items-center pointer-events-none text-ink-muted">
        <MagnifyingGlass size={20} weight="light" />
      </div>
      <input
        type="search"
        value={queryInput}
        oninput={handleInput}
        placeholder="Search songs, artists, albums, or playlists..."
        class="w-full h-11 pl-11 pr-10 rounded-xs bg-surface-1 border border-border text-ink text-sm sm:text-base placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        autocomplete="off"
        spellcheck="false"
        aria-label="Search"
      />
      {#if queryInput}
        <button
          type="button"
          onclick={clearQuery}
          class="absolute right-3 text-ink-muted hover:text-ink p-1 rounded-xs transition-colors"
          aria-label="Clear search"
        >
          <X size={16} weight="bold" />
        </button>
      {/if}
    </div>

    <!-- Category filter tabs -->
    <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-border text-xs sm:text-sm">
      <button
        type="button"
        onclick={() => setTab('all')}
        class="px-3 py-1.5 rounded-xs transition-colors shrink-0 {activeTab === 'all' ? 'bg-surface-2 text-ink font-medium border-b-2 border-accent' : 'text-ink-muted hover:text-ink hover:bg-surface-1'}"
      >
        All
      </button>
      <button
        type="button"
        onclick={() => setTab('tracks')}
        class="px-3 py-1.5 rounded-xs transition-colors shrink-0 {activeTab === 'tracks' ? 'bg-surface-2 text-ink font-medium border-b-2 border-accent' : 'text-ink-muted hover:text-ink hover:bg-surface-1'}"
      >
        Tracks
      </button>
      <button
        type="button"
        onclick={() => setTab('albums')}
        class="px-3 py-1.5 rounded-xs transition-colors shrink-0 {activeTab === 'albums' ? 'bg-surface-2 text-ink font-medium border-b-2 border-accent' : 'text-ink-muted hover:text-ink hover:bg-surface-1'}"
      >
        Albums
      </button>
      <button
        type="button"
        onclick={() => setTab('artists')}
        class="px-3 py-1.5 rounded-xs transition-colors shrink-0 {activeTab === 'artists' ? 'bg-surface-2 text-ink font-medium border-b-2 border-accent' : 'text-ink-muted hover:text-ink hover:bg-surface-1'}"
      >
        Artists
      </button>
      <button
        type="button"
        onclick={() => setTab('playlists')}
        class="px-3 py-1.5 rounded-xs transition-colors shrink-0 {activeTab === 'playlists' ? 'bg-surface-2 text-ink font-medium border-b-2 border-accent' : 'text-ink-muted hover:text-ink hover:bg-surface-1'}"
      >
        Playlists
      </button>
    </div>
  </div>

  <!-- Search Results Body -->
  {#if !debouncedQuery}
    <!-- Initial empty search prompt -->
    <div class="py-16 flex flex-col items-center justify-center text-center">
      <div class="size-12 rounded-full bg-surface-1 flex items-center justify-center text-ink-muted mb-4">
        <MagnifyingGlass size={24} weight="light" />
      </div>
      <h2 class="font-display text-xl text-ink font-normal mb-1">Search NAAD</h2>
      <p class="text-xs sm:text-sm text-ink-muted max-w-sm">
        Discover tracks, artists, albums and curated playlists across Indian classical, Bollywood, and global hi-res archives.
      </p>
    </div>
  {:else if searchQuery.isPending}
    <!-- Loading skeleton -->
    <div class="flex flex-col gap-6" aria-label="Loading search results">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-5">
          <Skeleton class="h-4 w-24 mb-3" />
          <Skeleton class="h-56 w-full rounded-sm" />
        </div>
        <div class="lg:col-span-7">
          <Skeleton class="h-4 w-24 mb-3" />
          <div class="flex flex-col gap-2">
            {#each Array(5) as _}
              <Skeleton class="h-11 w-full rounded-xs" />
            {/each}
          </div>
        </div>
      </div>
    </div>
  {:else if !searchResults || (searchResults.tracks.length === 0 && searchResults.albums.length === 0 && searchResults.artists.length === 0 && searchResults.playlists.length === 0)}
    <!-- No matches found -->
    <EmptyState
      title="No results found"
      description={`Could not find any matches for "${debouncedQuery}". Check your spelling or try searching for another artist or song.`}
    />
  {:else}
    <!-- 'All' Tab View: Top Result + Top Tracks, then horizontal shelves -->
    {#if activeTab === 'all'}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Top Result Card -->
        {#if searchResults.topResult}
          {@const top = searchResults.topResult}
          <div class="lg:col-span-5 flex flex-col gap-3">
            <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Top Result</h2>
            <div
              class="group relative rounded-sm border border-border bg-surface-1 hover:bg-surface-2 p-5 transition-all cursor-pointer flex flex-col gap-4"
              role="button"
              tabindex="0"
              onclick={handleTopResultClick}
              onkeydown={(e) => e.key === 'Enter' && handleTopResultClick()}
            >
              <div class="relative size-24 sm:size-28 shrink-0 rounded-xs overflow-hidden bg-surface-2 border border-border">
                <Artwork
                  src={bestImageUrl(top.item.images, 200) ?? ('album' in top.item ? bestImageUrl(top.item.album?.images, 200) : undefined)}
                  alt={top.type === 'artist' ? top.item.name : top.item.title}
                  size={120}
                  class={top.type === 'artist' ? 'rounded-full' : ''}
                />
              </div>

              <div class="flex flex-col gap-1 min-w-0">
                <span class="font-mono text-2xs uppercase tracking-wider text-accent">
                  {top.type}
                </span>
                <h3 class="font-display text-xl sm:text-2xl text-ink font-normal leading-snug truncate">
                  {top.type === 'artist' ? top.item.name : top.item.title}
                </h3>
                <p class="text-xs sm:text-sm text-ink-muted truncate">
                  {#if top.type === 'track'}
                    {top.item.artists.map((a) => a.name).join(', ')} · {top.item.album?.title ?? 'Single'}
                  {:else if top.type === 'album'}
                    {top.item.artists.map((a) => a.name).join(', ')} · {top.item.releaseDate?.slice(0, 4) ?? 'Album'}
                  {:else if top.type === 'artist'}
                    Artist
                  {/if}
                </p>
              </div>

              {#if top.type === 'track'}
                <div class="mt-auto flex items-center justify-end pt-2 border-t border-border">
                  <button
                    type="button"
                    onclick={(e) => {
                      e.stopPropagation();
                      playTrack(top.item);
                    }}
                    class="size-10 rounded-full bg-accent text-surface-0 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                    aria-label={`Play ${top.item.title}`}
                  >
                    <Play size={20} />
                  </button>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Top Tracks Table (4-5 tracks) -->
        {#if searchResults.tracks.length > 0}
          <div class="{searchResults.topResult ? 'lg:col-span-7' : 'lg:col-span-12'} flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Songs</h2>
              {#if searchResults.tracks.length > 5}
                <button
                  type="button"
                  onclick={() => setTab('tracks')}
                  class="font-mono text-2xs text-ink-muted hover:text-accent transition-colors"
                >
                  View all ({searchResults.tracks.length})
                </button>
              {/if}
            </div>
            <TrackTable
              tracks={searchResults.tracks.slice(0, 5)}
              showArtwork={true}
              showAlbum={false}
              {likedIds}
              currentId={player.currentTrack?.id}
              playing={player.status === 'playing'}
              onplay={(t) => playTrack(t)}
              onlike={(t) => toggleLikeTrack(t, likedIds.has(t.id))}
            />
          </div>
        {/if}
      </div>

      <!-- Albums Shelf -->
      {#if searchResults.albums.length > 0}
        <section class="flex flex-col gap-3 mt-4" aria-label="Albums">
          <div class="flex items-center justify-between">
            <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Albums</h2>
            <button
              type="button"
              onclick={() => setTab('albums')}
              class="font-mono text-2xs text-ink-muted hover:text-accent transition-colors"
            >
              See all
            </button>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {#each searchResults.albums.slice(0, 6) as album (album.id)}
              <MediaCard
                title={album.title}
                subtitle={album.artists.map((a) => a.name).join(', ')}
                image={bestImageUrl(album.images, 300)}
                href={`/album/${album.id}`}
                onplay={() => playAlbumById(album.id)}
              />
            {/each}
          </div>
        </section>
      {/if}

      <!-- Artists Shelf -->
      {#if searchResults.artists.length > 0}
        <section class="flex flex-col gap-3 mt-4" aria-label="Artists">
          <div class="flex items-center justify-between">
            <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Artists</h2>
            <button
              type="button"
              onclick={() => setTab('artists')}
              class="font-mono text-2xs text-ink-muted hover:text-accent transition-colors"
            >
              See all
            </button>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {#each searchResults.artists.slice(0, 6) as artist (artist.id)}
              <MediaCard
                title={artist.name}
                subtitle="Artist"
                image={bestImageUrl(artist.images, 300)}
                href={`/artist/${artist.id}`}
                shape="circle"
              />
            {/each}
          </div>
        </section>
      {/if}

      <!-- Playlists Shelf -->
      {#if searchResults.playlists.length > 0}
        <section class="flex flex-col gap-3 mt-4" aria-label="Playlists">
          <div class="flex items-center justify-between">
            <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Playlists</h2>
            <button
              type="button"
              onclick={() => setTab('playlists')}
              class="font-mono text-2xs text-ink-muted hover:text-accent transition-colors"
            >
              See all
            </button>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {#each searchResults.playlists.slice(0, 6) as playlist (playlist.id)}
              <MediaCard
                title={playlist.title}
                subtitle={playlist.description ?? 'Playlist'}
                image={bestImageUrl(playlist.images, 300)}
                href={`/playlist/${playlist.id}`}
                onplay={() => playPlaylistById(playlist.id)}
              />
            {/each}
          </div>
        </section>
      {/if}
    {:else if activeTab === 'tracks'}
      <!-- All Tracks view -->
      <div class="flex flex-col gap-3">
        <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">
          All Songs ({searchResults.tracks.length})
        </h2>
        <TrackTable
          tracks={searchResults.tracks}
          showArtwork={true}
          showAlbum={true}
          {likedIds}
          currentId={player.currentTrack?.id}
          playing={player.status === 'playing'}
          onplay={(t) => playTrack(t)}
          onlike={(t) => toggleLikeTrack(t, likedIds.has(t.id))}
        />
        {@render loadMoreButton()}
      </div>
    {:else if activeTab === 'albums'}
      <!-- All Albums view -->
      <div class="flex flex-col gap-3">
        <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">
          All Albums ({searchResults.albums.length})
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {#each searchResults.albums as album (album.id)}
            <MediaCard
              title={album.title}
              subtitle={album.artists.map((a) => a.name).join(', ')}
              image={bestImageUrl(album.images, 300)}
              href={`/album/${album.id}`}
              onplay={() => playAlbumById(album.id)}
            />
          {/each}
        </div>
        {@render loadMoreButton()}
      </div>
    {:else if activeTab === 'artists'}
      <!-- All Artists view -->
      <div class="flex flex-col gap-3">
        <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">
          All Artists ({searchResults.artists.length})
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {#each searchResults.artists as artist (artist.id)}
            <MediaCard
              title={artist.name}
              subtitle="Artist"
              image={bestImageUrl(artist.images, 300)}
              href={`/artist/${artist.id}`}
              shape="circle"
            />
          {/each}
        </div>
        {@render loadMoreButton()}
      </div>
    {:else if activeTab === 'playlists'}
      <!-- All Playlists view -->
      <div class="flex flex-col gap-3">
        <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">
          All Playlists ({searchResults.playlists.length})
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {#each searchResults.playlists as playlist (playlist.id)}
            <MediaCard
              title={playlist.title}
              subtitle={playlist.description ?? 'Playlist'}
              image={bestImageUrl(playlist.images, 300)}
              href={`/playlist/${playlist.id}`}
              onplay={() => playPlaylistById(playlist.id)}
            />
          {/each}
        </div>
        {@render loadMoreButton()}
      </div>
    {/if}
  {/if}
</div>
