<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { bestImageUrl } from '$lib/art';
import { extractAmbientPalette, type AmbientPalette } from '$lib/color/ambient';
import { formatDurationMs, joinArtists } from '$lib/format';
import { Pause, Play, Repeat, Shuffle, SkipNext, SkipPrevious } from '$lib/icons';
import { player } from '$lib/player/engine.svelte';
import { createAlbumQuery, createLikedContainsQuery, createTrackQuery, toggleLikeTrack } from '$lib/queries';
import ArtistLinks from '$lib/ui/ArtistLinks.svelte';
import Artwork from '$lib/ui/Artwork.svelte';
import IconButton from '$lib/ui/IconButton.svelte';
import LyricsStage from '$lib/ui/LyricsStage.svelte';
import PlayingIndicator from '$lib/ui/PlayingIndicator.svelte';
import QualityBadge from '$lib/ui/QualityBadge.svelte';
import Scrubber from '$lib/ui/Scrubber.svelte';
import CaretDown from 'phosphor-svelte/lib/CaretDown';
import Heart from 'phosphor-svelte/lib/Heart';
import SpeakerHigh from 'phosphor-svelte/lib/SpeakerHigh';
import SpeakerLow from 'phosphor-svelte/lib/SpeakerLow';
import SpeakerSimpleX from 'phosphor-svelte/lib/SpeakerSimpleX';

type NowPlayingTab = 'player' | 'lyrics' | 'queue';
type PanelTab = 'lyrics' | 'queue';

// Two separate pieces of state, not one: on desktop the right pane (Lyrics/Up next) is *always* visible
// alongside the left (Track) column — 'player' was never a real state for it, there's nothing to show for
// it — while on mobile only one column shows at a time, Track included. Collapsing both into one
// NowPlayingTab (as this used to) meant defaulting to 'player' — the Track tab, so mobile opens on the
// track like it's supposed to — left the desktop right pane with no matching branch to render: blank,
// with neither Lyrics nor Up next tab highlighted.
let panelTab = $state<PanelTab>('lyrics');
let mobileView = $state<'player' | 'panel'>('player');
let ambientPalette = $state<AmbientPalette>({
  ambient1: 'rgb(40, 38, 36)',
  ambient2: 'rgb(24, 23, 22)',
});

const routeTrackId = $derived(page.params.id);
const routeTrackQuery = createTrackQuery(() => routeTrackId ?? '');
const albumId = $derived(routeTrackQuery.data?.album?.id ?? '');
const albumQuery = createAlbumQuery(() => albumId);

// Track which route ID we have already loaded so we don't reload or loop
let loadedRouteId = $state<string | null>(null);

// If route specified a track ID and it's not currently playing, load and play it
$effect(() => {
  if (routeTrackId && routeTrackQuery.data && loadedRouteId !== routeTrackId) {
    loadedRouteId = routeTrackId;
    if (player.currentTrack?.id !== routeTrackId) {
      const existingIdx = player.queue.findIndex((t) => t.id === routeTrackId);
      if (existingIdx >= 0) {
        player.playIndex(existingIdx);
      } else {
        player.playTrack(routeTrackQuery.data, [routeTrackQuery.data]);
      }
    }
  }
});

// If the track loaded with only 1 song in queue, but has an album, populate the album queue
$effect(() => {
  if (
    albumQuery.data?.tracks &&
    albumQuery.data.tracks.length > 1 &&
    player.queue.length <= 1 &&
    player.currentTrack?.id === routeTrackId
  ) {
    const idx = albumQuery.data.tracks.findIndex((t) => t.id === routeTrackId);
    if (idx >= 0) {
      player.setQueue(albumQuery.data.tracks, idx);
    }
  }
});

// Keep URL path in sync with currentTrack without triggering full page reloads or loops
$effect(() => {
  const currentId = player.currentTrack?.id;
  // If the URL has a specific track ID that is still being loaded, do not bounce the URL away
  if (routeTrackId && (!routeTrackQuery.data || routeTrackQuery.isPending) && currentId !== routeTrackId) {
    return;
  }
  if (currentId && page.params.id !== currentId) {
    // Deliberately not touching loadedRouteId here: it's the "URL -> player" effect's own guard against
    // reprocessing a route id, and goto() below is async, so page.params.id (and routeTrackId, derived
    // from it) won't actually become currentId until it resolves. Setting loadedRouteId to currentId early
    // made that effect see loadedRouteId out of sync with the still-stale routeTrackId in the meantime and
    // re-trigger playback of the track we just left. Leaving it alone means only that other effect ever
    // writes it, and it naturally catches up once the URL genuinely changes.
    const search = page.url.search;
    goto(`/now-playing/${currentId}${search}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  }
});

// Sync tab from URL query param if present (?tab=queue, ?tab=lyrics, ?tab=player)
$effect(() => {
  const queryTab = page.url.searchParams.get('tab') as NowPlayingTab | null;
  if (queryTab === 'lyrics' || queryTab === 'queue') {
    panelTab = queryTab;
    mobileView = 'panel';
  } else if (queryTab === 'player') {
    mobileView = 'player';
  }
});

// Like status query for currently playing track
const currentTrackIdList = $derived(player.currentTrack?.id ? [player.currentTrack.id] : []);
const likedQuery = createLikedContainsQuery(() => currentTrackIdList);
const isLiked = $derived(likedQuery.data ? likedQuery.data.has(player.currentTrack?.id ?? '') : false);

// Extract ambient colors from artwork when current track changes
$effect(() => {
  const artworkUrl =
    bestImageUrl(player.currentTrack?.images, 600) ?? bestImageUrl(player.currentTrack?.album?.images, 600);
  if (artworkUrl) {
    extractAmbientPalette(artworkUrl).then((palette) => {
      ambientPalette = palette;
    });
  }
});

const currentArtwork = $derived(
  bestImageUrl(player.currentTrack?.images, 600) ?? bestImageUrl(player.currentTrack?.album?.images, 600),
);

// Lyrics/Up next are "active" on two independent axes that can disagree: panelTab alone on desktop (the
// right pane always shows one of them, mobileView is meaningless there), but panelTab *and* mobileView on
// mobile (only one column is ever actually visible there — without the mobileView check, switching to
// Track wouldn't visually deselect a Lyrics/Up next tab still "active" in the background, so both would
// show highlighted at once).
function tabClass(desktopActive: boolean, mobileActive: boolean): string {
  const desktop = desktopActive
    ? 'lg:border-accent lg:text-ink'
    : 'lg:border-transparent lg:text-ink-muted lg:hover:text-ink';
  const mobile = mobileActive
    ? 'max-lg:border-accent max-lg:text-ink'
    : 'max-lg:border-transparent max-lg:text-ink-muted max-lg:hover:text-ink';
  return `${desktop} ${mobile}`;
}

function switchTab(tab: NowPlayingTab) {
  if (tab === 'player') {
    mobileView = 'player';
  } else {
    panelTab = tab;
    mobileView = 'panel';
  }
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState({}, '', url.toString());
}

function handleClose() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    goto('/');
  }
}
</script>

<svelte:head>
  <title>{player.currentTrack ? `${player.currentTrack.title} — Now Playing — NAAD` : 'Now Playing — NAAD'}</title>
</svelte:head>

<div
  class="relative flex flex-col h-full w-full overflow-hidden bg-surface-0 select-none text-ink"
  style:--ambient-1={ambientPalette.ambient1}
  style:--ambient-2={ambientPalette.ambient2}
>
  <!-- Single approved backdrop: blurred, darkened artwork with subtle gradient for contrast >= 4.5:1 -->
  {#if currentArtwork}
    <div class="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden="true">
      <div
        class="absolute -inset-16 bg-cover bg-center filter blur-3xl opacity-25 scale-110 transition-opacity duration-700"
        style:background-image="url('{currentArtwork}')"
      ></div>
      <div class="absolute inset-0 bg-gradient-to-b from-surface-0/75 via-surface-0/90 to-surface-0"></div>
    </div>
  {/if}

  <!-- Top Header Navigation -->
  <header class="relative z-10 flex h-14 shrink-0 items-center justify-between px-3 sm:px-6 border-b border-border/40">
    <button
      type="button"
      onclick={handleClose}
      class="inline-flex items-center gap-1.5 p-2 text-ink-muted hover:text-ink transition-colors focus-visible:outline-none"
      aria-label="Dismiss Now Playing"
    >
      <CaretDown size={20} weight="light" />
      <span class="text-xs font-medium max-sm:hidden">Close</span>
    </button>

    <!-- Center Tab Switcher -->
    <nav class="flex items-center gap-1 sm:gap-2 overflow-x-auto" aria-label="Now Playing View">
      <!-- Player tab: mobile-only switcher since desktop always displays Player column -->
      <button
        type="button"
        onclick={() => switchTab('player')}
        class="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors border-b-2 lg:hidden"
        class:border-accent={mobileView === 'player'}
        class:text-ink={mobileView === 'player'}
        class:border-transparent={mobileView !== 'player'}
        class:text-ink-muted={mobileView !== 'player'}
        class:hover:text-ink={mobileView !== 'player'}
      >
        Track
      </button>

      <button
        type="button"
        onclick={() => switchTab('lyrics')}
        class="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors border-b-2 {tabClass(
          panelTab === 'lyrics',
          panelTab === 'lyrics' && mobileView === 'panel',
        )}"
      >
        Lyrics
      </button>

      <button
        type="button"
        onclick={() => switchTab('queue')}
        class="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors border-b-2 {tabClass(
          panelTab === 'queue',
          panelTab === 'queue' && mobileView === 'panel',
        )}"
      >
        Up next
      </button>
    </nav>

    <!-- Right Header Action -->
    <div class="flex items-center gap-1">
      {#if player.currentTrack}
        <button
          type="button"
          onclick={() => {
            if (player.currentTrack) {
              toggleLikeTrack(player.currentTrack, isLiked);
            }
          }}
          class="p-2 text-ink-muted hover:text-accent transition-colors"
          class:text-accent={isLiked}
          aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
        >
          <Heart size={18} weight={isLiked ? 'fill' : 'light'} />
        </button>
      {/if}
    </div>
  </header>

  <!-- Main Stage Area -->
  <main class="relative z-10 flex flex-1 min-h-0 overflow-hidden">
    <!-- Desktop Split Stage (Left: Artwork Hero & Transport, Right: Active Tab) -->
    <div class="flex flex-col lg:flex-row flex-1 min-w-0 h-full max-w-7xl mx-auto w-full px-4 sm:px-8 py-4 sm:py-6 gap-6 lg:gap-12">
      <!-- Left Column: Artwork, Sleeve Typography, and Full Transport Controls -->
      <section
        class="now-playing-left flex flex-col items-center shrink-0 lg:w-[400px] xl:w-[420px] max-lg:max-w-md max-lg:mx-auto w-full gap-2.5 sm:gap-3 overflow-y-auto pr-3 sm:pr-4"
        class:max-lg:hidden={mobileView !== 'player'}
        aria-label="Current Track Details"
      >
        <!-- Large Sleeve Artwork: 2-4px radius, hairline border, strictly no card drop-shadow -->
        <div class="relative shrink-0 rounded-xs border border-border overflow-hidden bg-surface-2 mt-auto lg:mt-0">
          <Artwork
            src={currentArtwork}
            alt={player.currentTrack?.title ?? 'Now playing artwork'}
            size={280}
            class="size-[200px] sm:size-[240px] lg:size-[260px] xl:size-[280px] object-cover"
          />
        </div>

        <!-- Typography & Hierarchy: Fraunces Display Title + IBM Plex Sans Artists -->
        <div class="w-full text-center min-w-0">
          <h1 class="font-display text-lg sm:text-xl text-ink font-normal leading-snug truncate">
            {player.currentTrack?.title ?? 'No track playing'}
          </h1>
          <p class="text-sm text-ink-muted leading-tight truncate mt-1">
            {#if player.currentTrack}
              <ArtistLinks artists={player.currentTrack.artists} />
            {:else}
              —
            {/if}
          </p>

          <!-- Quality Readout. Fixed height so its row doesn't collapse (and shift the scrubber below it up)
               for the moment between tracks where currentAudio is briefly null. -->
          <div class="mt-2 flex h-4 items-center justify-center gap-2">
            {#if player.currentAudio}
              <QualityBadge audio={player.currentAudio} />
            {/if}
          </div>
        </div>

        <!-- Hairline Scrubber with Mono Tabular Timecodes -->
        <div class="w-full">
          <Scrubber
            bind:value={player.currentTime}
            duration={player.duration}
            buffered={player.buffered}
            onseek={(s) => player.seek(s)}
            onscrubend={(s) => player.commitSeek(s)}
            size="lg"
            showTime={true}
          />
        </div>

        <!-- Custom Transport SVG Controls -->
        <div class="flex items-center justify-center gap-3 w-full">
          <IconButton
            label="Shuffle"
            size="md"
            active={player.shuffle}
            onclick={() => player.toggleShuffle()}
          >
            <Shuffle size={18} />
          </IconButton>

          <IconButton
            label="Previous"
            size="lg"
            disabled={!player.hasPrevious}
            onclick={() => player.previous()}
          >
            <SkipPrevious size={22} />
          </IconButton>

          <IconButton
            variant="transport"
            size="lg"
            label={player.status === 'playing' ? 'Pause' : 'Play'}
            onclick={() => player.togglePlay()}
          >
            {#if player.status === 'playing'}
              <Pause size={24} />
            {:else}
              <Play size={24} />
            {/if}
          </IconButton>

          <IconButton
            label="Next"
            size="lg"
            disabled={!player.hasNext}
            onclick={() => player.next()}
          >
            <SkipNext size={22} />
          </IconButton>

          <IconButton
            label="Repeat"
            size="md"
            active={player.repeat !== 'off'}
            onclick={() => player.toggleRepeat()}
          >
            <Repeat size={18} />
          </IconButton>
        </div>

        <!-- Volume Control Slider -->
        <div class="flex items-center gap-2 w-full max-w-sm pt-1 mb-auto lg:mb-0">
          <button
            type="button"
            onclick={() => player.toggleMute()}
            class="text-ink-muted hover:text-ink transition-colors p-1"
            aria-label={player.muted ? 'Unmute' : 'Mute'}
          >
            {#if player.muted || player.volume === 0}
              <SpeakerSimpleX size={18} weight="light" />
            {:else if player.volume < 0.5}
              <SpeakerLow size={18} weight="light" />
            {:else}
              <SpeakerHigh size={18} weight="light" />
            {/if}
          </button>

          <div class="relative flex-1 h-1 group flex items-center">
            <div class="absolute inset-0 rounded-full bg-surface-3" aria-hidden="true"></div>
            <div
              class="absolute inset-y-0 left-0 rounded-full bg-ink-muted group-hover:bg-ink transition-colors"
              style:width="{(player.muted ? 0 : player.volume) * 100}%"
              aria-hidden="true"
            ></div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={player.muted ? 0 : player.volume}
              oninput={(e) => player.setVolume(Number(e.currentTarget.value))}
              class="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink"
              aria-label="Volume"
            />
          </div>
        </div>
      </section>

      <!-- Right Column: Tab Viewport (Lyrics Stage / Up next Queue) -->
      <section
        class="flex flex-col flex-1 min-w-0 h-full overflow-hidden"
        class:max-lg:hidden={mobileView === 'player'}
        aria-label="Tab Content"
      >
        <div class="flex-1 min-h-0 overflow-hidden">
          {#if panelTab === 'lyrics'}
            {#if player.currentTrack || routeTrackId}
              <LyricsStage
                trackId={(player.currentTrack?.id ?? routeTrackId)!}
                currentTime={player.currentTime}
                onseek={(s) => player.commitSeek(s)}
              />
            {:else}
              <div class="flex items-center justify-center h-full w-full text-ink-muted text-sm">
                No track currently selected.
              </div>
            {/if}
          {:else if panelTab === 'queue'}
            <!-- Up next Queue List -->
            <div class="flex flex-col h-full w-full overflow-y-auto pr-2 py-4" aria-label="Playback queue">
              <p class="font-mono text-2xs uppercase tracking-wider text-ink-faint mb-3">Up next in queue</p>
              <div class="flex flex-col gap-1">
                {#each player.queue as track, idx (track.id ?? idx)}
                  {@const isCurrent = idx === player.queueIndex}
                  <button
                    type="button"
                    onclick={() => player.playIndex(idx)}
                    class="flex items-center justify-between p-2.5 rounded-xs transition-colors text-left"
                    class:bg-surface-2={isCurrent}
                    class:hover:bg-surface-1={!isCurrent}
                  >
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                      <span class="font-mono text-xs text-ink-muted w-5 shrink-0 text-center" data-numeric>
                        {#if isCurrent && player.status === 'playing'}
                          <PlayingIndicator />
                        {:else}
                          {idx + 1}
                        {/if}
                      </span>
                      <Artwork
                        src={bestImageUrl(track.images, 100) ?? bestImageUrl(track.album?.images, 100)}
                        alt=""
                        size={36}
                      />
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium" class:text-accent={isCurrent} class:text-ink={!isCurrent}>
                          {track.title}
                        </p>
                        <p class="truncate text-xs text-ink-muted mt-0.5">
                          {joinArtists(track.artists)}
                        </p>
                      </div>
                    </div>
                    <div class="flex items-center gap-3 pl-3 shrink-0">
                      <span class="font-mono text-xs text-ink-muted" data-numeric>
                        {formatDurationMs(track.durationMs)}
                      </span>
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Mobile-only compact transport strip when inside a tab (Lyrics/Queue) -->
        <div class="lg:hidden flex items-center justify-between pt-3 pb-1 border-t border-border/40 shrink-0">
          <div class="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
            <Artwork
              src={currentArtwork}
              alt=""
              size={32}
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-medium text-ink leading-tight">
                {player.currentTrack?.title ?? 'No track'}
              </p>
              <p class="truncate text-2xs text-ink-muted leading-tight mt-0.5">
                {#if player.currentTrack}
                  <ArtistLinks artists={player.currentTrack.artists} />
                {:else}
                  —
                {/if}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <IconButton
              size="sm"
              label="Previous"
              disabled={!player.hasPrevious}
              onclick={() => player.previous()}
            >
              <SkipPrevious size={18} />
            </IconButton>

            <IconButton
              variant="transport"
              size="sm"
              label={player.status === 'playing' ? 'Pause' : 'Play'}
              onclick={() => player.togglePlay()}
            >
              {#if player.status === 'playing'}
                <Pause size={18} />
              {:else}
                <Play size={18} />
              {/if}
            </IconButton>

            <IconButton
              size="sm"
              label="Next"
              disabled={!player.hasNext}
              onclick={() => player.next()}
            >
              <SkipNext size={18} />
            </IconButton>
          </div>
        </div>
      </section>
    </div>
  </main>
</div>

<style>
  .now-playing-left {
    justify-content: safe center;
  }
</style>
