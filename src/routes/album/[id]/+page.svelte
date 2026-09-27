<script lang="ts">
import { page } from '$app/state';
import { bestImageUrl } from '$lib/art';
import { formatDurationMs, joinArtists } from '$lib/format';
import { Play, Shuffle } from '$lib/icons';
import { player } from '$lib/player/engine.svelte';
import {
  createAlbumQuery,
  createLikedContainsQuery,
  createSavedAlbumsQuery,
  toggleLikeTrack,
  toggleSaveAlbum,
} from '$lib/queries';
import Artwork from '$lib/ui/Artwork.svelte';
import Button from '$lib/ui/Button.svelte';
import Skeleton from '$lib/ui/Skeleton.svelte';
import TrackTable from '$lib/ui/TrackTable.svelte';
import ArrowClockwise from 'phosphor-svelte/lib/ArrowClockwise';
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
import BookmarkSimple from 'phosphor-svelte/lib/BookmarkSimple';

const albumId = $derived(page.params.id ?? '');
const albumQuery = createAlbumQuery(() => albumId);

// Batched liked songs check for all tracks on this album
const trackIds = $derived((albumQuery.data?.tracks ?? []).map((t) => t.id));
const likedQuery = createLikedContainsQuery(() => trackIds);
const likedIds = $derived(likedQuery.data ?? new Set<string>());

// Saved state comes from the library; `savedOverride` is the optimistic value while a toggle is in flight.
const savedAlbumsQuery = createSavedAlbumsQuery();
let savedOverride = $state<boolean | null>(null);
let saving = $state(false); // a second click while the first is in flight would race the first
const savedInLibrary = $derived(
  savedOverride ?? (savedAlbumsQuery.data?.items ?? []).some((item) => item.album.id === albumId),
);

const totalDurationMs = $derived(
  (albumQuery.data?.tracks ?? []).reduce((acc, t) => acc + (t.durationMs ?? 0), 0),
);

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

async function toggleSave() {
  if (saving) return;
  saving = true;
  const wasSaved = savedInLibrary;
  savedOverride = !wasSaved;
  try {
    await toggleSaveAlbum(albumId, albumQuery.data?.title ?? 'album', wasSaved);
  } catch {
    // the toggle already told the user
  } finally {
    savedOverride = null; // the refreshed library is the truth again
    saving = false;
  }
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

        <h1 class="font-display text-lg sm:text-xl text-ink font-normal leading-tight mt-1 break-words">
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
            disabled={saving}
            class={savedInLibrary ? 'text-accent border-accent/40' : ''}
          >
            <BookmarkSimple size={18} weight={savedInLibrary ? 'fill' : 'light'} />
            <span>{savedInLibrary ? 'Saved' : 'Save'}</span>
          </Button>
        </div>
      </div>
    </header>

    <!-- 3. Tracklist -->
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

    <!-- 4. Liner Notes & Sleeve Metadata Details Area -->
    <section class="mt-8 rounded-sm border border-border bg-surface-1 p-6 flex flex-col gap-6">
      <div class="flex items-center justify-between border-b border-border pb-3">
        <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">
          Liner Notes & Catalog Record
        </h2>
        <span class="font-mono text-2xs text-ink-faint">NAAD Technical Specification</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
        <div>
          <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint block">Release Date</span>
          <span class="text-ink font-medium mt-1 block">{album.releaseDate ?? '—'}</span>
        </div>
        <div>
          <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint block">Record Label</span>
          <span class="text-ink font-medium mt-1 block">{album.label ?? 'Independent / Not specified'}</span>
        </div>
        <div>
          <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint block">Total Duration</span>
          <span class="font-mono text-ink mt-1 block" data-numeric>{formatDurationMs(totalDurationMs)} ({album.tracks.length} tracks)</span>
        </div>
      </div>

    </section>
  {/if}
</div>
