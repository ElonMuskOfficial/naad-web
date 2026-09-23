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
// quality/duration/album columns line up like a spreadsheet or a CD tracklist.
//
// The template itself changes at the sm breakpoint (not just its *contents*): on mobile the
// like/menu/album/quality tracks don't exist at all, rather than existing at zero width, so a
// narrow viewport never has to lay out columns it has nowhere to put — set via a real CSS media
// query (arbitrary-property utility), not a value computed once in JS.
const desktopGrid = $derived(
  showAlbum
    ? 'sm:[--track-row-grid:28px_minmax(0,1fr)_minmax(0,180px)_150px_20px_48px_20px]'
    : 'sm:[--track-row-grid:28px_minmax(0,1fr)_150px_20px_48px_20px]',
);
</script>

<div class="[--track-row-grid:28px_minmax(0,1fr)_44px_24px] {desktopGrid}">
  <div
    class="grid items-center gap-3 px-2 pb-2 text-2xs uppercase tracking-wide text-ink-faint max-sm:hidden"
    style:grid-template-columns="var(--track-row-grid)"
  >
    <span class="text-right" data-numeric>#</span>
    <span>Title</span>
    {#if showAlbum}<span>Album</span>{/if}
    <span>Quality</span>
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
