<script lang="ts">
import { page } from '$app/state';
import { goto } from '$app/navigation';
import { bestImageUrl } from '$lib/art';
import {
  createArtistQuery,
  createFollowedArtistsQuery,
  createLikedContainsQuery,
  playAlbumById,
  toggleFollowArtist,
} from '$lib/queries';
import { player } from '$lib/player/engine.svelte';
import type { Track } from '$lib/types';
import Artwork from '$lib/ui/Artwork.svelte';
import Button from '$lib/ui/Button.svelte';
import MediaCard from '$lib/ui/MediaCard.svelte';
import Skeleton from '$lib/ui/Skeleton.svelte';
import TrackTable from '$lib/ui/TrackTable.svelte';
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
import Check from 'phosphor-svelte/lib/Check';
import Heart from 'phosphor-svelte/lib/Heart';
import Plus from 'phosphor-svelte/lib/Plus';
import { Play } from '$lib/icons';

const artistId = $derived(page.params.id ?? '');
const artistQuery = createArtistQuery(() => artistId);

// Check if artist is followed in library
const followedQuery = createFollowedArtistsQuery();
const isFollowed = $derived.by(() => {
  const items = followedQuery.data?.items ?? [];
  return items.some((item) => item.artist.id === artistId);
});

let following = $state(false);
$effect(() => {
  following = isFollowed;
});

// Liked tracks query
const trackIds = $derived((artistQuery.data?.topTracks ?? []).map((t) => t.id));
const likedQuery = createLikedContainsQuery(() => trackIds);
const likedIds = $derived(likedQuery.data ?? new Set<string>());

let showAllTopTracks = $state(false);

const displayedTracks = $derived.by(() => {
  const tracks = artistQuery.data?.topTracks ?? [];
  return showAllTopTracks ? tracks : tracks.slice(0, 5);
});

function playAllTopTracks() {
  const tracks = artistQuery.data?.topTracks;
  if (tracks && tracks.length > 0) {
    player.playTrack(tracks[0]!, tracks);
  }
}

let followBusy = $state(false);

async function toggleFollow() {
  if (followBusy) return;
  followBusy = true;
  const prev = following;
  following = !following; // optimistic; the toggle reverts it on failure
  try {
    following = await toggleFollowArtist(artistId, artistQuery.data?.name ?? 'artist', prev);
  } catch {
    following = prev;
  } finally {
    followBusy = false;
  }
}
</script>

<svelte:head>
  <title>{artistQuery.data?.name ? `${artistQuery.data.name} — NAAD` : 'Artist — NAAD'}</title>
</svelte:head>

<div class="px-4 py-6 sm:px-6 sm:py-8 max-w-7xl mx-auto flex flex-col gap-8">
  <!-- Back navigation -->
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

  {#if artistQuery.isPending}
    <!-- Loading skeleton -->
    <div class="flex flex-col gap-8" aria-label="Loading artist">
      <div class="flex flex-col sm:flex-row items-center sm:items-end gap-6 pb-6 border-b border-border">
        <Skeleton class="size-44 sm:size-48 rounded-full shrink-0" />
        <div class="flex flex-col items-center sm:items-start gap-3 min-w-0 flex-1">
          <Skeleton class="h-3 w-16" />
          <Skeleton class="h-10 w-64 max-w-md" />
          <div class="flex items-center gap-3 mt-2">
            <Skeleton class="h-9 w-24 rounded-full" />
            <Skeleton class="h-9 w-28 rounded-xs" />
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <Skeleton class="h-4 w-32 mb-2" />
        {#each Array(5) as _}
          <Skeleton class="h-11 w-full rounded-xs" />
        {/each}
      </div>
    </div>
  {:else if artistQuery.isError || !artistQuery.data}
    <div class="py-16 flex flex-col items-center justify-center text-center">
      <p class="text-sm text-ink-muted mb-4">Could not load artist profile.</p>
      <Button variant="outline" onclick={() => artistQuery.refetch()}>Try again</Button>
    </div>
  {:else}
    {@const artist = artistQuery.data}

    <!-- 1. Editorial Artist Liner-Notes Header -->
    <header class="flex flex-col sm:flex-row items-center sm:items-end gap-6 pb-6 border-b border-border">
      <div class="relative size-40 sm:size-48 shrink-0 rounded-full overflow-hidden bg-surface-2 border border-border shadow-xs">
        <Artwork
          src={bestImageUrl(artist.images, 400)}
          alt={artist.name}
          size={200}
          radius="full"
          class="size-full object-cover"
        />
      </div>

      <div class="flex flex-col items-center sm:items-start min-w-0 flex-1 text-center sm:text-left">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Artist</span>
        <h1 class="font-display text-lg sm:text-xl text-ink font-normal leading-tight mt-1 mb-4 break-words">
          {artist.name}
        </h1>

        <!-- Header Actions: Play Top Tracks, Follow -->
        <div class="flex flex-wrap items-center justify-center sm:justify-start gap-3">
          {#if (artist.topTracks?.length ?? 0) > 0}
            <Button variant="solid" onclick={playAllTopTracks}>
              <Play size={16} />
              <span>Play</span>
            </Button>
          {/if}

          <Button
            variant={following ? 'outline' : 'solid'}
            onclick={toggleFollow}
            disabled={followBusy}
            aria-label={following ? 'Following artist' : 'Follow artist'}
          >
            {#if following}
              <Check size={16} weight="bold" />
              <span>Following</span>
            {:else}
              <Plus size={16} weight="bold" />
              <span>Follow</span>
            {/if}
          </Button>
        </div>
      </div>
    </header>

    <!-- 2. Top Tracks Section -->
    {#if (artist.topTracks?.length ?? 0) > 0}
      <section class="flex flex-col gap-4" aria-label="Popular tracks">
        <div class="flex items-center justify-between">
          <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Popular Songs</h2>
          {#if artist.topTracks.length > 5}
            <button
              type="button"
              onclick={() => (showAllTopTracks = !showAllTopTracks)}
              class="font-mono text-2xs text-ink-muted hover:text-accent transition-colors"
            >
              {showAllTopTracks ? 'Show less' : `Show all (${artist.topTracks.length})`}
            </button>
          {/if}
        </div>

        <TrackTable
          tracks={displayedTracks}
          showArtwork={true}
          showAlbum={true}
          {likedIds}
          currentId={player.currentTrack?.id}
          playing={player.status === 'playing'}
          onplay={(t) => player.playTrack(t, artist.topTracks)}
        />
      </section>
    {/if}

    <!-- 3. Discography: Albums Shelf -->
    {#if (artist.albums?.length ?? 0) > 0}
      <section class="flex flex-col gap-4" aria-label="Discography: Albums">
        <div class="flex items-center justify-between">
          <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Albums</h2>
          <span class="font-mono text-2xs text-ink-faint">{artist.albums.length} releases</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {#each artist.albums as album (album.id)}
            <MediaCard
              fluid
              title={album.title}
              subtitle={album.releaseDate ? album.releaseDate.slice(0, 4) : 'Album'}
              image={album.images?.[0]?.url}
              href={`/album/${album.id}`}
              onplay={() => playAlbumById(album.id)}
            />
          {/each}
        </div>
      </section>
    {/if}

    <!-- 4. Discography: Singles & EPs Shelf -->
    {#if (artist.singles?.length ?? 0) > 0}
      <section class="flex flex-col gap-4" aria-label="Discography: Singles and EPs">
        <div class="flex items-center justify-between">
          <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Singles & EPs</h2>
          <span class="font-mono text-2xs text-ink-faint">{artist.singles.length} releases</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {#each artist.singles as single (single.id)}
            <MediaCard
              fluid
              title={single.title}
              subtitle={single.releaseDate ? single.releaseDate.slice(0, 4) : 'Single'}
              image={single.images?.[0]?.url}
              href={`/album/${single.id}`}
              onplay={() => playAlbumById(single.id)}
            />
          {/each}
        </div>
      </section>
    {/if}

    <!-- 5. Related Artists Shelf -->
    {#if (artist.related?.length ?? 0) > 0}
      <section class="flex flex-col gap-4" aria-label="Fans also like">
        <div class="flex items-center justify-between">
          <h2 class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Fans Also Like</h2>
          <span class="font-mono text-2xs text-ink-faint">Similar artists</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {#each artist.related.slice(0, 12) as rel (rel.id)}
            <MediaCard
              fluid
              title={rel.name}
              subtitle="Artist"
              image={rel.images?.[0]?.url}
              href={`/artist/${rel.id}`}
              shape="circle"
            />
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</div>
