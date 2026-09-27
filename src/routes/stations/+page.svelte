<script lang="ts">
import { bestImageUrl } from '$lib/art';
import { Play } from '$lib/icons';
import { createStationsQuery, playStation } from '$lib/queries';
import Artwork from '$lib/ui/Artwork.svelte';
import EmptyState from '$lib/ui/EmptyState.svelte';
import Skeleton from '$lib/ui/Skeleton.svelte';

const stationsQuery = createStationsQuery();

// Only the clicked card is disabled while its station starts — the rest of the grid stays usable.
let startingId = $state<string | null>(null);

async function handlePlay(station: { id: string; name: string; language: string | null }) {
  if (startingId) return;
  startingId = station.id;
  try {
    await playStation(station.name, station.language);
  } finally {
    startingId = null;
  }
}
</script>

<svelte:head>
  <title>Radio Stations — NAAD</title>
</svelte:head>

<div class="px-4 py-6 sm:px-6 sm:py-8 max-w-7xl mx-auto flex flex-col gap-6">
  <div>
    <h1 class="font-display text-3xl sm:text-4xl text-ink font-normal leading-tight">Radio Stations</h1>
    <p class="text-xs sm:text-sm text-ink-muted mt-1">
      JioSaavn's own curated stations — mood, language and artist presets.
    </p>
  </div>

  {#if stationsQuery.isPending}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {#each Array(12) as _}
        <div class="flex flex-col gap-2">
          <Skeleton class="aspect-square w-full rounded-sm" />
          <Skeleton class="h-4 w-3/4" />
        </div>
      {/each}
    </div>
  {:else if stationsQuery.isError || !stationsQuery.data || stationsQuery.data.length === 0}
    <EmptyState
      title="No stations available"
      description="JioSaavn didn't return any curated stations right now. Try again later."
    />
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {#each stationsQuery.data as station (station.id)}
        <button
          type="button"
          onclick={() => handlePlay(station)}
          disabled={startingId !== null}
          class="group flex flex-col gap-2 rounded-xs p-1 -m-1 text-left hover:bg-surface-2 transition-colors duration-[var(--duration-fast)] disabled:opacity-60"
        >
          <div class="relative">
            <Artwork src={bestImageUrl(station.images, 148)} alt="" size={148} />
            <div
              class="absolute inset-0 flex items-center justify-center rounded-sm transition-colors duration-[var(--duration-fast)] {startingId ===
              station.id
                ? 'bg-black/40'
                : 'bg-black/0 group-hover:bg-black/30'}"
            >
              {#if startingId === station.id}
                <span class="font-mono text-2xs text-white">Starting…</span>
              {:else}
                <span
                  class="flex size-9 items-center justify-center rounded-full bg-accent text-accent-ink opacity-0 shadow-float transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100"
                >
                  <Play size={16} />
                </span>
              {/if}
            </div>
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-ink">{station.name}</p>
            {#if station.subtitle}<p class="truncate text-xs text-ink-muted">{station.subtitle}</p>{/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
