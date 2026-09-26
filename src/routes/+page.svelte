<script lang="ts">
import { goto } from '$app/navigation';
import { bestImageUrl } from '$lib/art';
import { joinArtists } from '$lib/format';
import { player } from '$lib/player/engine.svelte';
import { createHomeQuery } from '$lib/queries';
import type { Album, Artist, Playlist, Track } from '$lib/types';
import Button from '$lib/ui/Button.svelte';
import EmptyState from '$lib/ui/EmptyState.svelte';
import MediaCard from '$lib/ui/MediaCard.svelte';
import Shelf from '$lib/ui/Shelf.svelte';
import Skeleton from '$lib/ui/Skeleton.svelte';
import ArrowClockwise from 'phosphor-svelte/lib/ArrowClockwise';

const homeQuery = createHomeQuery();
</script>

<svelte:head>
  <title>NAAD — Home</title>
</svelte:head>

<div class="px-4 py-6 sm:px-6 sm:py-8 max-w-7xl mx-auto flex flex-col gap-8">
  <!-- Header: Content starts at top, editorial sleeve typography -->
  <div>
    <h1 class="font-display text-2xl sm:text-3xl text-ink font-normal">Discover</h1>
  </div>

  {#if homeQuery.isPending}
    <!-- Skeletons matching real shelf layout: 3 shelves with titles and card rows (no shimmer) -->
    <div class="flex flex-col gap-8" aria-label="Loading discovery shelves">
      {#each [1, 2, 3] as shelfIdx (shelfIdx)}
        <section class="min-w-0">
          <div class="mb-3 flex items-baseline justify-between gap-4 px-1">
            <Skeleton class="h-5 w-44 rounded-xs" />
          </div>
          <div class="flex gap-4 overflow-hidden pb-1 pl-1">
            {#each [1, 2, 3, 4, 5, 6] as cardIdx (cardIdx)}
              <div
                class="flex shrink-0 flex-col gap-2 rounded-xs p-1 -m-1"
                style="width: 148px;"
              >
                <Skeleton class="size-[148px] rounded-sm shrink-0" />
                <div class="min-w-0 flex flex-col gap-1.5 pt-0.5">
                  <Skeleton class="h-4 w-28 rounded-xs" />
                  <Skeleton class="h-3 w-20 rounded-xs" />
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {:else if homeQuery.isError}
    <!-- Inline problem message with retry button -->
    <div class="rounded-sm border border-border bg-surface-1 p-6 text-center">
      <p class="text-sm font-medium text-ink">Unable to load discovery feed</p>
      <p class="text-xs text-ink-muted mt-1 max-w-md mx-auto">
        {homeQuery.error?.message ?? 'Communication with the NAAD engine failed.'}
      </p>
      <Button
        variant="outline"
        size="sm"
        class="mt-4"
        onclick={() => homeQuery.refetch()}
      >
        <ArrowClockwise size={16} weight="light" />
        <span>Retry</span>
      </Button>
    </div>
  {:else if homeQuery.data?.sections && homeQuery.data.sections.length > 0}
    <!-- Render all sections by kind exhaustively -->
    <div class="flex flex-col gap-8">
      {#each homeQuery.data.sections as section (section.id)}
        <Shelf title={section.title}>
          {#if section.kind === 'tracks'}
            {#each section.items as item, idx (item.id)}
              {@const track = item as Track}
              <MediaCard
                href={track.album ? `/album/${track.album.id}` : '#'}
                title={track.title}
                subtitle={joinArtists(track.artists)}
                image={bestImageUrl(track.images, 300) ?? bestImageUrl(track.album?.images, 300)}
                size={148}
                rank={section.id.includes('top') || section.id.includes('chart') ? idx + 1 : undefined}
                onplay={() => player.playTrack(track, section.items as Track[])}
              />
            {/each}
          {:else if section.kind === 'albums'}
            {#each section.items as item (item.id)}
              {@const album = item as Album}
              <MediaCard
                href={`/album/${album.id}`}
                title={album.title}
                subtitle={album.releaseDate ? album.releaseDate.slice(0, 4) : (album.artists?.length ? joinArtists(album.artists) : undefined)}
                image={bestImageUrl(album.images, 300)}
                size={148}
              />
            {/each}
          {:else if section.kind === 'artists'}
            {#each section.items as item (item.id)}
              {@const artist = item as Artist}
              <MediaCard
                href={`/artist/${artist.id}`}
                title={artist.name}
                subtitle="Artist"
                shape="circle"
                image={bestImageUrl(artist.images, 300)}
                size={148}
              />
            {/each}
          {:else if section.kind === 'playlists'}
            {#each section.items as item (item.id)}
              {@const playlist = item as Playlist}
              <MediaCard
                href={`/playlist/${playlist.id}`}
                title={playlist.title}
                subtitle={playlist.description ?? (playlist.trackCount ? `${playlist.trackCount} tracks` : undefined)}
                image={bestImageUrl(playlist.images, 300)}
                size={148}
              />
            {/each}
          {/if}
        </Shelf>
      {/each}
    </div>
  {:else}
    <!-- Empty state in NAAD voice -->
    <div class="rounded-sm border border-border bg-surface-1 p-8">
      <EmptyState
        title="Library and discovery are empty"
        description="Search for tracks and artists across Indian and global music, or import a playlist link to begin."
        action={{
          label: 'Search catalog',
          onClick: () => goto('/search'),
        }}
      />
    </div>
  {/if}
</div>
