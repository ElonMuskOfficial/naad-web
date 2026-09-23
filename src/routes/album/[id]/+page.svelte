<script lang="ts">
import { page } from '$app/state';
import { bestImageUrl } from '$lib/art';
import { formatDurationMs, joinArtists } from '$lib/format';
import { Play, Shuffle } from '$lib/icons';
import { player } from '$lib/player/engine.svelte';
import { createAlbumQuery, createLikedContainsQuery, toggleLikeTrack } from '$lib/queries';
import { toast } from '$lib/toast.svelte';
import type { Track } from '$lib/types';
import Artwork from '$lib/ui/Artwork.svelte';
import Button from '$lib/ui/Button.svelte';
import Skeleton from '$lib/ui/Skeleton.svelte';
import TrackTable from '$lib/ui/TrackTable.svelte';
import ArrowClockwise from 'phosphor-svelte/lib/ArrowClockwise';
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
import BookmarkSimple from 'phosphor-svelte/lib/BookmarkSimple';
import Disc from 'phosphor-svelte/lib/Disc';

const albumId = $derived(page.params.id ?? '');
const albumQuery = createAlbumQuery(() => albumId);

// Batched liked songs check for all tracks on this album
const trackIds = $derived((albumQuery.data?.tracks ?? []).map((t) => t.id));
const likedQuery = createLikedContainsQuery(() => trackIds);
const likedIds = $derived(likedQuery.data ?? new Set<string>());

let savedInLibrary = $state(false);

const totalDurationMs = $derived(
  (albumQuery.data?.tracks ?? []).reduce((acc, t) => acc + (t.durationMs ?? 0), 0),
);

// Disc grouping logic: checks if any track belongs to Disc > 1
const hasMultipleDiscs = $derived((albumQuery.data?.tracks ?? []).some((t) => (t.discNumber ?? 1) > 1));

const discGroups = $derived.by(() => {
  const tracks = albumQuery.data?.tracks ?? [];
  const map = new Map<number, Track[]>();
  for (const t of tracks) {
    const disc = t.discNumber ?? 1;
    if (!map.has(disc)) map.set(disc, []);
    map.get(disc)!.push(t);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b);
});

function playAll() {
  const tracks = albumQuery.data?.tracks;
  if (tracks && tracks.length > 0) {
    player.playTrack(tracks[0]!, tracks);
  }
}

function shuffleAll() {
  const tracks = albumQuery.data?.tracks;
  if (tracks && tracks.length > 0) {
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    player.shuffle = true;
    player.playTrack(shuffled[0]!, shuffled);
  }
}

function toggleSave() {
  savedInLibrary = !savedInLibrary;
  toast.push(
    savedInLibrary
      ? `Saved "${albumQuery.data?.title ?? 'album'}" to library`
      : `Removed "${albumQuery.data?.title ?? 'album'}" from library`,
  );
}
</script>

<svelte:head>
  <title>{albumQuery.data?.title ? `${albumQuery.data.title} — NAAD` : 'Album — NAAD'}</title>
</svelte:head>

<div class="px-4 py-6 sm:px-6 sm:py-8 max-w-7xl mx-auto flex flex-col gap-8">
  <!-- Back navigation breadcrumb -->
  <div class="flex items-center gap-2">
    <button
      type="button"
      onclick={() => window.history.back()}
      class="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
      aria-label="Back"
    >
      <ArrowLeft size={16} weight="light" />
      <span>Back</span>
    </button>
  </div>

  {#if albumQuery.isPending}
    <!-- Loading skeleton matching liner-notes layout -->
    <div class="flex flex-col gap-8" aria-label="Loading album">
      <div class="flex flex-col sm:flex-row items-start sm:items-end gap-6 pb-6 border-b border-border">
        <Skeleton class="size-[200px] rounded-sm shrink-0" />
        <div class="flex flex-col gap-3 min-w-0 flex-1">
          <Skeleton class="h-3 w-16" />
          <Skeleton class="h-8 w-3/4 max-w-md" />
          <Skeleton class="h-4 w-40" />
          <Skeleton class="h-3 w-64" />
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-full" />
        <Skeleton class="h-8 w-full" />
      </div>
    </div>
  {:else if albumQuery.isError}
    <!-- Error view with retry -->
    <div class="rounded-sm border border-border bg-surface-1 p-8 text-center">
      <p class="text-sm font-medium text-ink">Album not found or unavailable</p>
      <p class="text-xs text-ink-muted mt-1 max-w-md mx-auto">
        {albumQuery.error?.message ?? 'Could not retrieve album information from the engine.'}
      </p>
      <Button
        variant="outline"
        size="sm"
        class="mt-4"
        onclick={() => albumQuery.refetch()}
      >
        <ArrowClockwise size={16} weight="light" />
        <span>Retry</span>
      </Button>
    </div>
  {:else if albumQuery.data}
    {@const album = albumQuery.data}
    <!-- 1. Liner-Notes Header -->
    <header class="flex flex-col sm:flex-row items-start sm:items-end gap-6 pb-6 border-b border-border">
      <Artwork
        src={bestImageUrl(album.images, 300)}
        alt={album.title}
        size={220}
        class="shrink-0 max-sm:size-[160px] shadow-float"
      />

      <div class="flex flex-col min-w-0 flex-1">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint">
          {album.albumType ? album.albumType.toUpperCase() : 'ALBUM'}
        </span>

        <h1 class="font-display text-2xl sm:text-3xl lg:text-4xl text-ink font-normal leading-tight mt-1">
          {album.title}
        </h1>

        <!-- Artists list with links -->
        <div class="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
          {#if album.artists && album.artists.length > 0}
            {#each album.artists as artist, i (artist.id)}
              <a href="/artist/{artist.id}" class="font-medium text-ink hover:underline">
                {artist.name}
              </a>
              {#if i < album.artists.length - 1}
                <span class="text-ink-muted">·</span>
              {/if}
            {/each}
          {:else if album.tracks?.[0]?.artists?.length}
            <span class="text-ink-muted">{joinArtists(album.tracks[0].artists)}</span>
          {/if}
        </div>

        <!-- Release metadata line in signal type system -->
        <div class="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted font-sans">
          {#if album.releaseDate}
            <span class="font-mono" data-numeric>{album.releaseDate.slice(0, 4)}</span>
            <span class="text-ink-faint">·</span>
          {/if}
          <span class="font-mono" data-numeric>{album.tracks.length} tracks</span>
          <span class="text-ink-faint">·</span>
          <span class="font-mono" data-numeric>{formatDurationMs(totalDurationMs)}</span>
          {#if album.label}
            <span class="text-ink-faint">·</span>
            <span class="truncate max-w-[200px]">{album.label}</span>
          {/if}
          {#if album.upc}
            <span class="text-ink-faint">·</span>
            <span class="font-mono text-2xs text-ink-faint">UPC {album.upc}</span>
          {/if}
        </div>

        <!-- 2. Action Buttons -->
        <div class="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="solid" size="md" onclick={playAll}>
            <Play />
            <span>Play</span>
          </Button>

          <Button variant="outline" size="md" onclick={shuffleAll}>
            <Shuffle />
            <span>Shuffle</span>
          </Button>

          <Button
            variant="outline"
            size="md"
            onclick={toggleSave}
            class={savedInLibrary ? 'text-accent border-accent/40' : ''}
          >
            <BookmarkSimple size={18} weight={savedInLibrary ? 'fill' : 'light'} />
            <span>{savedInLibrary ? 'Saved' : 'Save'}</span>
          </Button>
        </div>
      </div>
    </header>

    <!-- 3. Tracklist (TrackTable with disc grouping) -->
    <div class="flex flex-col gap-6">
      {#if hasMultipleDiscs}
        {#each discGroups as [discNum, discTracks] (discNum)}
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2 px-2 py-2 border-b border-border text-xs text-ink-faint font-mono uppercase tracking-wider">
              <Disc size={16} weight="light" />
              <span>Disc {discNum}</span>
            </div>
            <TrackTable
              tracks={discTracks}
              showArtwork={false}
              showAlbum={false}
              {likedIds}
              currentId={player.currentTrack?.id}
              playing={player.status === 'playing'}
              onplay={(t) => player.playTrack(t, album.tracks)}
              onlike={(t) => toggleLikeTrack(t, likedIds.has(t.id))}
            />
          </div>
        {/each}
      {:else}
        <TrackTable
          tracks={album.tracks}
          showArtwork={false}
          showAlbum={false}
          {likedIds}
          currentId={player.currentTrack?.id}
          playing={player.status === 'playing'}
          onplay={(t) => player.playTrack(t, album.tracks)}
          onlike={(t) => toggleLikeTrack(t, likedIds.has(t.id))}
        />
      {/if}
    </div>

    <!-- 4. Liner Notes & Sleeve Metadata Details Area -->
    <section class="mt-8 rounded-sm border border-border bg-surface-1 p-6 flex flex-col gap-6">
      <div class="flex items-center justify-between border-b border-border pb-3">
        <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">
          Liner Notes & Catalog Record
        </h2>
        <span class="font-mono text-2xs text-ink-faint">NAAD Technical Specification</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint block">Release Date</span>
          <span class="text-ink font-medium mt-1 block">{album.releaseDate ?? '—'}</span>
        </div>
        <div>
          <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint block">Record Label</span>
          <span class="text-ink font-medium mt-1 block">{album.label ?? 'Independent / Not specified'}</span>
        </div>
        <div>
          <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint block">Universal Product Code</span>
          <span class="font-mono text-ink mt-1 block" data-numeric>{album.upc ?? '—'}</span>
        </div>
        <div>
          <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint block">Total Duration</span>
          <span class="font-mono text-ink mt-1 block" data-numeric>{formatDurationMs(totalDurationMs)} ({album.tracks.length} tracks)</span>
        </div>
      </div>

      <!-- Per-track ISRC Registry -->
      <div class="border-t border-border pt-4">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint block mb-3">
          Per-Track International Standard Recording Codes (ISRC)
        </span>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {#each album.tracks as track, i (track.id)}
            <div class="flex items-center justify-between p-2 rounded-xs bg-surface-2/60 text-xs">
              <div class="flex items-center gap-2 min-w-0 flex-1 pr-2">
                <span class="font-mono text-2xs text-ink-faint w-4 text-right" data-numeric>{i + 1}</span>
                <span class="truncate text-ink">{track.title}</span>
              </div>
              <span class="font-mono text-2xs text-ink-muted shrink-0" data-numeric>
                {track.isrc ?? 'NO ISRC'}
              </span>
            </div>
          {/each}
        </div>
      </div>
    </section>
  {/if}
</div>
