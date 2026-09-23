<script lang="ts">
import { joinArtists } from '$lib/format';
import { Pause, Play, Repeat, Shuffle, SkipNext, SkipPrevious } from '$lib/icons';
import { player } from '$lib/player/engine.svelte';
import Heart from 'phosphor-svelte/lib/Heart';
import Queue from 'phosphor-svelte/lib/Queue';
import Quotes from 'phosphor-svelte/lib/Quotes';
import SpeakerHigh from 'phosphor-svelte/lib/SpeakerHigh';
import SpeakerLow from 'phosphor-svelte/lib/SpeakerLow';
import SpeakerSimpleX from 'phosphor-svelte/lib/SpeakerSimpleX';
import Artwork from './Artwork.svelte';
import IconButton from './IconButton.svelte';
import QualityBadge from './QualityBadge.svelte';
import Scrubber from './Scrubber.svelte';

let liked = $state(false);

function toggleTab(tab: 'queue' | 'lyrics') {
  if (player.rightPanelOpen && player.activeTab === tab) {
    player.rightPanelOpen = false;
  } else {
    player.activeTab = tab;
    player.rightPanelOpen = true;
  }
}
</script>

<footer
  class="relative flex h-[72px] shrink-0 items-center justify-between border-t border-border bg-surface-1 px-4 select-none max-sm:hidden"
  aria-label="Audio Player"
>
  <!-- Ambient top edge tint: exactly the thin top edge tinted with --ambient-1 from the spec -->
  <div
    class="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-ambient-1 opacity-70"
    aria-hidden="true"
  ></div>

  <!-- Left: Artwork & Track info -->
  <div class="flex w-[260px] shrink-0 items-center gap-3">
    <a href="/now-playing" class="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none">
      <Artwork
        src={player.currentTrack?.images?.[0]?.url}
        alt={player.currentTrack?.title ?? 'Track artwork'}
        size={48}
      />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-ink leading-snug hover:underline">
          {player.currentTrack?.title ?? 'No track selected'}
        </p>
        <p class="truncate text-xs text-ink-muted leading-tight mt-0.5">
          {player.currentTrack ? joinArtists(player.currentTrack.artists) : '—'}
        </p>
      </div>
    </a>
    {#if player.currentTrack}
      <button
        type="button"
        onclick={() => (liked = !liked)}
        class="shrink-0 p-1 text-ink-muted hover:text-accent transition-colors"
        class:text-accent={liked}
        aria-label={liked ? 'Unlike' : 'Like'}
        aria-pressed={liked}
      >
        <Heart size={18} weight={liked ? 'fill' : 'light'} />
      </button>
    {/if}
  </div>

  <!-- Center: Transport controls & Scrubber -->
  <div class="flex flex-1 max-w-xl flex-col items-center justify-center gap-1 px-4">
    <!-- Transport Buttons -->
    <div class="flex items-center gap-2">
      <IconButton
        label="Shuffle"
        size="sm"
        active={player.shuffle}
        onclick={() => player.toggleShuffle()}
      >
        <Shuffle />
      </IconButton>

      <IconButton
        label="Previous"
        size="md"
        onclick={() => player.previous()}
      >
        <SkipPrevious />
      </IconButton>

      <IconButton
        variant="transport"
        size="md"
        label={player.status === 'playing' ? 'Pause' : 'Play'}
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

      <IconButton
        label="Repeat"
        size="sm"
        active={player.repeat !== 'off'}
        onclick={() => player.toggleRepeat()}
      >
        <Repeat />
      </IconButton>
    </div>

    <!-- Scrubber -->
    <div class="w-full">
      <Scrubber
        bind:value={player.currentTime}
        duration={player.duration}
        buffered={player.buffered}
        onseek={(s) => player.seek(s)}
        size="sm"
        showTime={true}
      />
    </div>
  </div>

  <!-- Right: Quality badge, secondary toggles & volume -->
  <div class="flex w-[260px] shrink-0 items-center justify-end gap-3">
    {#if player.selectedSource}
      <QualityBadge source={player.selectedSource} />
    {/if}

    <div class="flex items-center gap-1">
      <IconButton
        label="Lyrics"
        size="sm"
        active={player.rightPanelOpen && player.activeTab === 'lyrics'}
        onclick={() => toggleTab('lyrics')}
      >
        <Quotes size={16} weight="light" />
      </IconButton>

      <IconButton
        label="Up next queue"
        size="sm"
        active={player.rightPanelOpen && player.activeTab === 'queue'}
        onclick={() => toggleTab('queue')}
      >
        <Queue size={16} weight="light" />
      </IconButton>
    </div>

    <!-- Volume Control -->
    <div class="flex items-center gap-1.5 pl-1">
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

      <div class="relative w-20 h-1 group flex items-center">
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
  </div>
</footer>
