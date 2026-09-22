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

// A real grid, not a stack of cards: header and every row share this template, so the
// quality/duration/album columns line up exactly the way a spreadsheet or a CD tracklist would.
const grid = $derived(
  ['28px', 'minmax(0,1fr)', showAlbum ? 'minmax(0,180px)' : null, '150px', '20px', '48px', '20px']
    .filter(Boolean)
    .join(' '),
);
</script>

<div style:--track-row-grid={grid}>
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
        onmenu={(anchor) => onmenu?.(track, anchor)}
      />
    {/each}
  </div>
</div>
