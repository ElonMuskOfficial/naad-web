<script lang="ts">
import type { Track } from '$lib/types';
import TrackRow from './TrackRow.svelte';

interface Props {
  tracks: Track[];
  showArtwork?: boolean;
  showAlbum?: boolean;
  likedIds?: Set<string>;
  currentId?: string | null;
  playing?: boolean;
  startIndex?: number;
  onplay?: (track: Track, index: number) => void;
  onlike?: (track: Track) => void;
  onmenu?: (track: Track, anchor: HTMLElement) => void;
}

let {
  tracks,
  showArtwork = true,
  showAlbum = true,
  likedIds,
  currentId = null,
  playing = false,
  startIndex = 1,
  onplay,
  onlike,
  onmenu,
}: Props = $props();

// A real grid, not a stack of cards: header and every row share one template, so the
// duration/album columns line up like a spreadsheet or a CD tracklist.
//
// The template itself changes at the sm breakpoint (not just its *contents*): on mobile the
// like/menu/album tracks don't exist at all, rather than existing at zero width, so a
// narrow viewport never has to lay out columns it has nowhere to put — set via a real CSS media
// query (arbitrary-property utility), not a value computed once in JS.
</script>

<div class="track-table {showAlbum ? 'has-album' : 'no-album'}">
  <div
    class="grid items-center gap-3 px-2 pb-2 text-2xs uppercase tracking-wide text-ink-faint max-sm:hidden track-table-grid"
  >
    <span class="text-right" data-numeric>#</span>
    <span>Title</span>
    {#if showAlbum}<span>Album</span>{/if}
    <span></span>
    <span class="text-right">Time</span>
    <span></span>
  </div>
  <div class="border-t border-border">
    {#each tracks as track, i (track.id)}
      <TrackRow
        {track}
        index={startIndex + i}
        {showArtwork}
        {showAlbum}
        liked={likedIds?.has(track.id) ?? false}
        status={track.id === currentId ? (playing ? 'playing' : 'current') : 'idle'}
        onplay={() => onplay?.(track, i)}
        onlike={() => onlike?.(track)}
        onmenu={onmenu ? (anchor) => onmenu(track, anchor) : undefined}
      />
    {/each}
  </div>
</div>

<style>
  .track-table {
    --track-row-grid: 28px minmax(0, 1fr) 44px 24px;
  }
  @media (min-width: 640px) {
    .track-table.no-album {
      --track-row-grid: 28px minmax(160px, 1fr) 20px 48px 20px;
    }
    .track-table.has-album {
      --track-row-grid: 28px minmax(160px, 1.5fr) minmax(110px, 1fr) 20px 48px 20px;
    }
  }
  .track-table-grid {
    grid-template-columns: var(--track-row-grid);
  }
</style>
