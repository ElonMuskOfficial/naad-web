<script lang="ts">
import DotsThree from 'phosphor-svelte/lib/DotsThree';
import Heart from 'phosphor-svelte/lib/Heart';
import { trackMenu } from '$lib/context-menu.svelte';
import { formatDurationMs, joinArtists } from '$lib/format';
import { Play } from '$lib/icons';
import type { Track } from '$lib/types';
import Artwork from './Artwork.svelte';
import PlayingIndicator from './PlayingIndicator.svelte';
import QualityBadge from './QualityBadge.svelte';

interface Props {
  track: Track;
  index: number;
  showArtwork?: boolean;
  showAlbum?: boolean;
  liked?: boolean;
  /** Named `status`, not `state` — a local `state` would collide with the `$state` rune. */
  status?: 'idle' | 'current' | 'playing';
  onplay?: () => void;
  onlike?: () => void;
  onmenu?: (anchor: HTMLElement) => void;
}

let {
  track,
  index,
  showArtwork = true,
  showAlbum = true,
  liked = false,
  status = 'idle',
  onplay,
  onlike,
  onmenu,
}: Props = $props();

const artist = $derived(joinArtists(track.artists.map((a) => a.name)));
const artwork = $derived(track.images[0]?.url ?? track.album?.images[0]?.url);
let menuButton = $state<HTMLElement>();
let rowElement = $state<HTMLElement>();
let touchTimer: ReturnType<typeof setTimeout> | null = null;

function triggerMenu(anchorEl?: HTMLElement) {
  const anchor = anchorEl ?? menuButton ?? rowElement;
  if (!anchor) return;
  if (onmenu) {
    onmenu(anchor);
  } else {
    trackMenu.openFor(track, anchor);
  }
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault();
  triggerMenu(menuButton ?? (e.currentTarget as HTMLElement));
}

function handleTouchStart() {
  touchTimer = setTimeout(() => {
    triggerMenu();
  }, 500);
}

function handleTouchEnd() {
  if (touchTimer) {
    clearTimeout(touchTimer);
    touchTimer = null;
  }
}
</script>

<!-- One data row of a real grid table (see TrackTable's --track-row-grid), not a card. -->
<div
  bind:this={rowElement}
  role="row"
  tabindex={-1}
  class="group grid items-center gap-3 rounded-xs px-2 text-sm h-11 sm:h-11 max-sm:h-14 hover:bg-surface-2 data-[current]:bg-surface-1 cursor-default select-none transition-colors"
  style:grid-template-columns="var(--track-row-grid)"
  data-current={status !== 'idle' ? '' : undefined}
  oncontextmenu={handleContextMenu}
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  ontouchcancel={handleTouchEnd}
>
  <button
    type="button"
    class="relative flex items-center justify-center text-ink-faint hover:text-ink"
    onclick={onplay}
    aria-label={status === 'playing' ? `Pause ${track.title}` : `Play ${track.title}`}
  >
    <span class="font-mono text-xs group-hover:opacity-0" class:opacity-0={status !== 'idle'} data-numeric>
      {index}
    </span>
    <span
      class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100"
      class:opacity-100={status !== 'idle'}
    >
      {#if status === 'playing'}
        <PlayingIndicator />
      {:else}
        <Play size={13} />
      {/if}
    </span>
  </button>

  <div class="flex min-w-0 items-center gap-3">
    {#if showArtwork}
      <Artwork src={artwork} alt="" size={36} />
    {/if}
    <div class="min-w-0">
      <p class="truncate font-medium leading-snug" class:text-accent={status !== 'idle'}>
        {track.title}
        {#if track.versionTags.includes('remix')}<span class="text-ink-faint font-normal"> · Remix</span>{/if}
        {#if track.versionTags.includes('live')}<span class="text-ink-faint font-normal"> · Live</span>{/if}
      </p>
      <p class="truncate text-xs text-ink-muted">
        {artist}{#if track.explicit}<span
            class="ml-1.5 rounded-[2px] border border-border-strong px-1 text-[10px] leading-4 align-middle"
            >E</span
          >{/if}
      </p>
    </div>
  </div>

  {#if showAlbum}
    {#if track.album}
      <a
        href="/album/{track.album.id}"
        class="truncate text-xs text-ink-muted hover:text-ink hover:underline max-sm:hidden"
      >
        {track.album.title}
      </a>
    {:else}
      <span class="max-sm:hidden" aria-hidden="true"></span>
    {/if}
  {/if}

  <div class="max-sm:hidden">
    {#if track.quality}
      <QualityBadge source={track.quality} interactive={false} />
    {/if}
  </div>

  <button
    type="button"
    onclick={onlike}
    class="max-sm:hidden opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-ink-muted hover:text-accent transition-opacity"
    class:opacity-100={liked}
    class:text-accent={liked}
    aria-pressed={liked}
    aria-label={liked ? `Remove ${track.title} from Liked Songs` : `Like ${track.title}`}
  >
    <Heart size={16} weight={liked ? 'fill' : 'regular'} />
  </button>

  <span class="font-mono text-xs text-ink-muted text-right" data-numeric>{formatDurationMs(track.durationMs)}</span>

  <!-- More options button: visible on hover/focus on desktop; always accessible on touch -->
  <button
    bind:this={menuButton}
    type="button"
    onclick={(e) => {
      e.stopPropagation();
      triggerMenu(menuButton);
    }}
    class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100 text-ink-muted hover:text-ink transition-opacity flex items-center justify-center p-1"
    aria-label="More options for {track.title}"
  >
    <DotsThree size={18} weight="bold" />
  </button>
</div>
