<script lang="ts">
import { formatDurationMs, joinArtists } from '$lib/format';
import { Play } from '$lib/icons';
import { player } from '$lib/player/engine.svelte';
import Artwork from './Artwork.svelte';
import IconButton from './IconButton.svelte';
import LyricsStage from './LyricsStage.svelte';
import PlayingIndicator from './PlayingIndicator.svelte';
import ArrowDown from 'phosphor-svelte/lib/ArrowDown';
import ArrowUp from 'phosphor-svelte/lib/ArrowUp';
import Trash from 'phosphor-svelte/lib/Trash';
import X from 'phosphor-svelte/lib/X';

const WIDTH_KEY = 'naad:rightPanelWidth';
const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 280;
const MAX_WIDTH = 480;

let panelWidth = $state(DEFAULT_WIDTH);
let isResizing = $state(false);
let showHistory = $state(false);

const upcomingTracks = $derived(
  !player.currentTrack
    ? player.queue
    : player.queueIndex >= 0
      ? player.queue.slice(player.queueIndex + 1)
      : [],
);

const previousTracks = $derived(
  player.queue.length > 0 && player.queueIndex > 0 ? player.queue.slice(0, player.queueIndex) : [],
);

// Initialize width from localStorage on mount
$effect(() => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(WIDTH_KEY);
    if (saved) {
      const parsed = Number.parseInt(saved, 10);
      if (!Number.isNaN(parsed)) {
        panelWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsed));
      }
    }
  }
});

function onResizeStart(e: PointerEvent) {
  e.preventDefault();
  isResizing = true;
  const startX = e.clientX;
  const startWidth = panelWidth;

  function onPointerMove(moveEvent: PointerEvent) {
    const delta = startX - moveEvent.clientX;
    const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta));
    panelWidth = newWidth;
  }

  function onPointerUp() {
    isResizing = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    try {
      localStorage.setItem(WIDTH_KEY, panelWidth.toString());
    } catch {
      // Storage unavailable
    }
  }

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}
</script>

{#if player.rightPanelOpen}
  <aside
    class="relative flex h-full flex-col shrink-0 border-l border-border bg-surface-1 select-none max-lg:hidden transition-[width] duration-[var(--duration-fast)]"
    style:width="{panelWidth}px"
    aria-label="Secondary Panel"
  >
    <!-- Resize Handle -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute -left-1 inset-y-0 w-2 cursor-col-resize z-20 hover:bg-accent/40 active:bg-accent/60 transition-colors"
      class:bg-accent={isResizing}
      onpointerdown={onResizeStart}
      title="Drag to resize panel"
    ></div>

    <!-- Panel Header with Tabs -->
    <div class="flex h-14 items-center justify-between px-3 border-b border-border">
      <div class="flex items-center gap-1 bg-surface-2 p-0.5 rounded-xs">
        <button
          type="button"
          onclick={() => (player.activeTab = 'queue')}
          class="px-2.5 py-1 text-xs font-medium rounded-xs transition-colors duration-[var(--duration-fast)]
            {player.activeTab === 'queue' ? 'bg-surface-1 text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}"
        >
          Up next
        </button>
        <button
          type="button"
          onclick={() => (player.activeTab = 'lyrics')}
          class="px-2.5 py-1 text-xs font-medium rounded-xs transition-colors duration-[var(--duration-fast)]
            {player.activeTab === 'lyrics' ? 'bg-surface-1 text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}"
        >
          Lyrics
        </button>
      </div>

      <IconButton
        label="Close panel"
        size="sm"
        onclick={() => (player.rightPanelOpen = false)}
      >
        <X size={16} weight="light" />
      </IconButton>
    </div>

    <!-- Panel Body -->
    <div class="flex-1 overflow-y-auto p-3 min-h-0">
      {#if player.activeTab === 'queue'}
        <!-- Up Next Content -->
        <div class="flex flex-col gap-4">
          <!-- Now Playing Card -->
          {#if player.currentTrack}
            <div>
              <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Now Playing</span>
              <div class="mt-1.5 flex items-center gap-2.5 p-2 rounded-xs bg-surface-2/80 border border-border">
                <Artwork
                  src={player.currentTrack.images?.[0]?.url ?? player.currentTrack.album?.images?.[0]?.url}
                  alt={player.currentTrack.title}
                  size={40}
                />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    {#if player.status === 'playing'}
                      <PlayingIndicator playing={true} />
                    {/if}
                    <p class="truncate text-xs font-medium text-ink">{player.currentTrack.title}</p>
                  </div>
                  <p class="truncate text-2xs text-ink-muted mt-0.5">{joinArtists(player.currentTrack.artists.map((a) => a.name))}</p>
                </div>
              </div>
            </div>
          {/if}

          <!-- Queue List -->
          <div>
            <div class="flex items-center justify-between pb-1">
              <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Next in Queue</span>
              <div class="flex items-center gap-2">
                <span class="font-mono text-2xs text-ink-faint" data-numeric>{upcomingTracks.length} {upcomingTracks.length === 1 ? 'track' : 'tracks'}</span>
                {#if upcomingTracks.length > 0}
                  <button
                    type="button"
                    onclick={() => player.clearQueue()}
                    class="font-mono text-2xs text-ink-muted hover:text-danger transition-colors"
                  >
                    Clear
                  </button>
                {/if}
              </div>
            </div>

            <div class="mt-1 flex flex-col gap-1">
              {#if upcomingTracks.length === 0}
                <div class="py-8 text-center text-xs text-ink-muted">
                  No upcoming tracks
                </div>
              {:else}
                {#each upcomingTracks as track, i (track.id + (player.queueIndex + 1 + i))}
                  {@const queueIdx = player.currentTrack ? player.queueIndex + 1 + i : i}
                  <div
                    class="group flex items-center justify-between gap-2 p-1.5 rounded-xs transition-colors duration-[var(--duration-fast)] hover:bg-surface-2"
                  >
                    <button
                      type="button"
                      onclick={() => player.playIndex(queueIdx)}
                      class="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                    >
                      <span class="font-mono text-2xs text-ink-faint w-4 text-center shrink-0" data-numeric>
                        {i + 1}
                      </span>
                      <Artwork
                        src={track.images?.[0]?.url ?? track.album?.images?.[0]?.url}
                        alt={track.title}
                        size={32}
                      />
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-xs text-ink">
                          {track.title}
                        </p>
                        <p class="truncate text-2xs text-ink-muted">{joinArtists(track.artists.map((a) => a.name))}</p>
                      </div>
                    </button>

                    <!-- Reorder & Remove Actions -->
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {#if i > 0}
                        <button
                          type="button"
                          onclick={() => player.moveInQueue(queueIdx, queueIdx - 1)}
                          class="p-0.5 text-ink-faint hover:text-ink transition-colors"
                          title="Move up"
                          aria-label="Move track up"
                        >
                          <ArrowUp size={12} weight="bold" />
                        </button>
                      {/if}
                      {#if i < upcomingTracks.length - 1}
                        <button
                          type="button"
                          onclick={() => player.moveInQueue(queueIdx, queueIdx + 1)}
                          class="p-0.5 text-ink-faint hover:text-ink transition-colors"
                          title="Move down"
                          aria-label="Move track down"
                        >
                          <ArrowDown size={12} weight="bold" />
                        </button>
                      {/if}
                      <button
                        type="button"
                        onclick={() => player.removeFromQueue(queueIdx)}
                        class="p-0.5 text-ink-faint hover:text-danger transition-colors ml-0.5"
                        title="Remove from queue"
                        aria-label="Remove track from queue"
                      >
                        <Trash size={12} weight="light" />
                      </button>
                    </div>

                    <span class="font-mono text-2xs text-ink-faint shrink-0 group-hover:hidden" data-numeric>
                      {formatDurationMs(track.durationMs)}
                    </span>
                  </div>
                {/each}
              {/if}
            </div>
          </div>

          <!-- Previously Played History (if any) -->
          {#if previousTracks.length > 0}
            <div class="pt-2 border-t border-border/40">
              <button
                type="button"
                onclick={() => (showHistory = !showHistory)}
                class="flex items-center justify-between w-full py-1 text-left group"
              >
                <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint group-hover:text-ink transition-colors">
                  Previously Played ({previousTracks.length})
                </span>
                <span class="font-mono text-2xs text-ink-faint group-hover:text-ink transition-colors">
                  {showHistory ? 'Hide' : 'Show'}
                </span>
              </button>

              {#if showHistory}
                <div class="mt-1 flex flex-col gap-1 opacity-70">
                  {#each previousTracks as track, pIdx (track.id + pIdx)}
                    <button
                      type="button"
                      onclick={() => player.playIndex(pIdx)}
                      class="group flex items-center justify-between gap-2 p-1.5 rounded-xs hover:bg-surface-2 transition-colors text-left"
                    >
                      <div class="flex items-center gap-2.5 min-w-0 flex-1">
                        <span class="font-mono text-2xs text-ink-faint w-4 text-center shrink-0" data-numeric>
                          {pIdx + 1}
                        </span>
                        <Artwork
                          src={track.images?.[0]?.url ?? track.album?.images?.[0]?.url}
                          alt={track.title}
                          size={32}
                        />
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-xs text-ink">{track.title}</p>
                          <p class="truncate text-2xs text-ink-muted">{joinArtists(track.artists.map((a) => a.name))}</p>
                        </div>
                      </div>
                      <span class="font-mono text-2xs text-ink-faint shrink-0" data-numeric>
                        {formatDurationMs(track.durationMs)}
                      </span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {:else}
        <!-- Lyrics Content using dedicated LyricsStage component -->
        <div class="h-full flex flex-col">
          {#if player.currentTrack}
            <LyricsStage
              trackId={player.currentTrack.id}
              currentTime={player.currentTime}
              onseek={(s) => player.seek(s)}
            />
          {:else}
            <div class="flex items-center justify-center h-full text-xs text-ink-muted">
              No track currently selected.
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </aside>
{/if}
