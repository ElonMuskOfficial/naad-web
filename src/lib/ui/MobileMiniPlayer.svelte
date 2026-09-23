<script lang="ts">
import { bestImageUrl } from '$lib/art';
import { joinArtists } from '$lib/format';
import { Pause, Play, SkipNext } from '$lib/icons';
import { player } from '$lib/player/engine.svelte';
import Artwork from './Artwork.svelte';
import IconButton from './IconButton.svelte';

const progressPct = $derived(
  player.duration > 0 ? Math.min(100, Math.max(0, (player.currentTime / player.duration) * 100)) : 0,
);
</script>

{#if player.currentTrack}
  <div
    class="relative flex h-[52px] shrink-0 items-center justify-between border-t border-border bg-surface-1 px-3 select-none sm:hidden"
    aria-label="Mini Player"
  >
    <!-- Hairline progress bar on top edge -->
    <div class="absolute inset-x-0 top-0 h-[2px] bg-surface-3" aria-hidden="true">
      <div
        class="h-full bg-accent transition-[width] duration-[var(--duration-fast)]"
        style:width="{progressPct}%"
      ></div>
    </div>

    <!-- Left: Artwork and Track Info -->
    <a
      href={`/now-playing/${player.currentTrack.id}`}
      class="flex min-w-0 flex-1 items-center gap-2.5 pr-2 focus-visible:outline-none"
    >
      <Artwork
        src={bestImageUrl(player.currentTrack.images, 100) ?? bestImageUrl(player.currentTrack.album?.images, 100)}
        alt={player.currentTrack.title}
        size={36}
      />
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs font-medium text-ink leading-tight">
          {player.currentTrack.title}
        </p>
        <p class="truncate text-2xs text-ink-muted leading-tight mt-0.5">
          {joinArtists(player.currentTrack.artists)}
        </p>
      </div>
    </a>

    <!-- Right: Transport buttons -->
    <div class="flex items-center gap-1 shrink-0">
      <IconButton
        label={player.status === 'playing' ? 'Pause' : 'Play'}
        size="md"
        onclick={() => player.togglePlay()}
      >
        {#if player.status === 'playing'}
          <Pause />
        {:else}
          <Play />
        {/if}
      </IconButton>

      <IconButton
        label="Next"
        size="md"
        onclick={() => player.next()}
      >
        <SkipNext />
      </IconButton>
    </div>
  </div>
{/if}
