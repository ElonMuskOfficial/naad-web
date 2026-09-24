<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { bestImageUrl } from '$lib/art';
import { extractAmbientPalette, type AmbientPalette } from '$lib/color/ambient';
import { formatDurationMs, joinArtists } from '$lib/format';
import { Pause, Play, Repeat, Shuffle, SkipNext, SkipPrevious } from '$lib/icons';
import { player } from '$lib/player/engine.svelte';
import { createLikedContainsQuery, createTrackQuery, toggleLikeTrack } from '$lib/queries';
import Artwork from '$lib/ui/Artwork.svelte';
import IconButton from '$lib/ui/IconButton.svelte';
import LyricsStage from '$lib/ui/LyricsStage.svelte';
import PlayingIndicator from '$lib/ui/PlayingIndicator.svelte';
import QualityBadge from '$lib/ui/QualityBadge.svelte';
import Scrubber from '$lib/ui/Scrubber.svelte';
import SignalPathCard from '$lib/ui/SignalPathCard.svelte';
import CaretDown from 'phosphor-svelte/lib/CaretDown';
import Heart from 'phosphor-svelte/lib/Heart';
import SpeakerHigh from 'phosphor-svelte/lib/SpeakerHigh';
import SpeakerLow from 'phosphor-svelte/lib/SpeakerLow';
import SpeakerSimpleX from 'phosphor-svelte/lib/SpeakerSimpleX';

type NowPlayingTab = 'player' | 'lyrics' | 'queue' | 'signal';

let activeTab = $state<NowPlayingTab>('lyrics');
let ambientPalette = $state<AmbientPalette>({
  ambient1: 'rgb(40, 38, 36)',
  ambient2: 'rgb(24, 23, 22)',
});

const routeTrackId = $derived(page.params.id);
const routeTrackQuery = createTrackQuery(() => routeTrackId ?? '');

// If route specified a track ID and it's not currently playing, load and play it
$effect(() => {
  if (routeTrackId && routeTrackQuery.data && player.currentTrack?.id !== routeTrackId) {
    player.playTrack(routeTrackQuery.data, [routeTrackQuery.data]);
  }
});

// Keep URL path in sync with currentTrack without triggering full page reloads
$effect(() => {
  const currentId = player.currentTrack?.id;
  if (currentId && page.params.id !== currentId) {
    const search = window.location.search;
    window.history.replaceState({}, '', `/now-playing/${currentId}${search}`);
  }
});

// Sync tab from URL query param if present (?tab=signal, ?tab=queue, ?tab=lyrics, ?tab=player)
$effect(() => {
  const queryTab = page.url.searchParams.get('tab') as NowPlayingTab | null;
  if (queryTab && ['player', 'lyrics', 'queue', 'signal'].includes(queryTab)) {
    activeTab = queryTab;
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

function switchTab(tab: NowPlayingTab) {
  activeTab = tab;
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
        class:border-accent={activeTab === 'player'}
        class:text-ink={activeTab === 'player'}
        class:border-transparent={activeTab !== 'player'}
        class:text-ink-muted={activeTab !== 'player'}
        class:hover:text-ink={activeTab !== 'player'}
      >
        Track
      </button>

      <button
        type="button"
        onclick={() => switchTab('lyrics')}
        class="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors border-b-2"
        class:border-accent={activeTab === 'lyrics'}
        class:text-ink={activeTab === 'lyrics'}
        class:border-transparent={activeTab !== 'lyrics'}
        class:text-ink-muted={activeTab !== 'lyrics'}
        class:hover:text-ink={activeTab !== 'lyrics'}
      >
        Lyrics
      </button>

      <button
        type="button"
        onclick={() => switchTab('queue')}
        class="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors border-b-2"
        class:border-accent={activeTab === 'queue'}
        class:text-ink={activeTab === 'queue'}
        class:border-transparent={activeTab !== 'queue'}
        class:text-ink-muted={activeTab !== 'queue'}
        class:hover:text-ink={activeTab !== 'queue'}
      >
        Up next
      </button>

      <button
        type="button"
        onclick={() => switchTab('signal')}
        class="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors border-b-2"
        class:border-accent={activeTab === 'signal'}
        class:text-ink={activeTab === 'signal'}
        class:border-transparent={activeTab !== 'signal'}
        class:text-ink-muted={activeTab !== 'signal'}
        class:hover:text-ink={activeTab !== 'signal'}
      >
        Signal path
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
        class="now-playing-left flex flex-col items-center lg:items-start shrink-0 lg:w-[400px] xl:w-[420px] max-lg:max-w-md max-lg:mx-auto w-full gap-2.5 sm:gap-3 overflow-y-auto pr-3 sm:pr-4"
        class:max-lg:hidden={activeTab !== 'player'}
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
        <div class="w-full text-center lg:text-left min-w-0">
          <h1 class="font-display text-lg sm:text-xl text-ink font-normal leading-snug break-words">
            {player.currentTrack?.title ?? 'No track playing'}
          </h1>
          <p class="text-sm text-ink-muted leading-tight truncate mt-1">
            {player.currentTrack ? joinArtists(player.currentTrack.artists) : '—'}
          </p>

          <!-- Quality Readout: Click switches directly to Signal path tab -->
          <div class="mt-2 flex items-center justify-center lg:justify-start gap-2">
            {#if player.selectedSource}
              <QualityBadge
                source={player.selectedSource}
                onclick={() => switchTab('signal')}
              />
            {:else if player.currentTrack?.quality}
              <QualityBadge
                source={player.currentTrack.quality}
                onclick={() => switchTab('signal')}
              />
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
            size="lg"
            showTime={true}
          />
        </div>

        <!-- Custom Transport SVG Controls -->
        <div class="flex items-center justify-center lg:justify-start gap-3 w-full">
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

      <!-- Right Column: Tab Viewport (Lyrics Stage / Up next Queue / Signal path) -->
      <section
        class="flex flex-col flex-1 min-w-0 h-full overflow-hidden"
        class:max-lg:hidden={activeTab === 'player'}
        aria-label="Tab Content"
      >
        <div class="flex-1 min-h-0 overflow-hidden">
          {#if activeTab === 'lyrics'}
            {#if player.currentTrack}
              <LyricsStage
                trackId={player.currentTrack.id}
                currentTime={player.currentTime}
                onseek={(s) => player.seek(s)}
              />
            {:else}
              <div class="flex items-center justify-center h-full w-full text-ink-muted text-sm">
                No track currently selected.
              </div>
            {/if}
          {:else if activeTab === 'queue'}
            <!-- Up next Queue List -->
            <div class="flex flex-col h-full w-full overflow-y-auto pr-2 py-4" aria-label="Playback queue">
              <p class="font-mono text-2xs uppercase tracking-wider text-ink-faint mb-3">Up next in queue</p>
              <div class="flex flex-col gap-1">
                {#each player.queue as track, idx (track.id ?? idx)}
                  {@const isCurrent = idx === player.queueIndex}
                  {@const effectiveQuality = player.currentTrack?.id === track.id && player.selectedSource ? player.selectedSource : (player.resolvedQualities[track.id] ?? track.quality)}
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
                      {#if effectiveQuality}
                        <QualityBadge source={effectiveQuality} interactive={false} />
                      {/if}
                      <span class="font-mono text-xs text-ink-muted" data-numeric>
                        {formatDurationMs(track.durationMs)}
                      </span>
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {:else if activeTab === 'signal'}
            <!-- Signal Path Technical Card -->
            <div class="h-full w-full overflow-y-auto py-4">
              <SignalPathCard
                selectedSource={player.selectedSource}
                alternatives={player.alternatives}
              />
            </div>
          {/if}
        </div>

        <!-- Mobile-only compact transport strip when inside a tab (Lyrics/Queue/Signal) -->
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
                {player.currentTrack ? joinArtists(player.currentTrack.artists) : '—'}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <IconButton
              size="sm"
              label="Previous"
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
