<script lang="ts">
import { joinArtists } from '$lib/format';
import { Pause, Play, Repeat, Shuffle, SkipNext, SkipPrevious } from '$lib/icons';
import { player } from '$lib/player/engine.svelte';
import { createLikedContainsQuery, toggleLikeTrack } from '$lib/queries';
import Heart from 'phosphor-svelte/lib/Heart';
import Queue from 'phosphor-svelte/lib/Queue';
import Quotes from 'phosphor-svelte/lib/Quotes';
import SpeakerHigh from 'phosphor-svelte/lib/SpeakerHigh';
import SpeakerLow from 'phosphor-svelte/lib/SpeakerLow';
import SpeakerSimpleX from 'phosphor-svelte/lib/SpeakerSimpleX';
import Artwork from './Artwork.svelte';
import IconButton from './IconButton.svelte';
import QualityBadge from './QualityBadge.svelte';
import { bestImageUrl } from '$lib/art';
import Scrubber from './Scrubber.svelte';

const likedQuery = createLikedContainsQuery(() => (player.currentTrack ? [player.currentTrack.id] : []));
const isLiked = $derived(Boolean(player.currentTrack && likedQuery.data?.has(player.currentTrack.id)));

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
  class="relative grid h-[72px] shrink-0 grid-cols-[1fr_2fr_1fr] items-center gap-4 border-t border-border bg-surface-1 px-4 select-none max-sm:hidden"
  aria-label="Audio Player"
>
  <!-- Ambient top edge tint: exactly the thin top edge tinted with --ambient-1 from the spec -->
  <div
    class="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-ambient-1 opacity-70"
    aria-hidden="true"
  ></div>

  <!-- Left: Artwork & Track info. This is a grid column (1fr, see footer), not a flexed/max-width box:
       a fixed max-width can't track "correct" across viewport sizes — too tight on a wide window, too
       loose on a narrow one — where an fr share of the row scales with it by construction. min-w-0 so
       the title/artist beneath (already truncate) can still shrink below their content size instead of
       forcing the column wider. -->
  <div class="flex min-w-0 items-center gap-3">
    {#if player.currentTrack}
      <a
        href={`/now-playing/${player.currentTrack.id}`}
        class="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none"
      >
        <Artwork
          src={bestImageUrl(player.currentTrack.images, 120) ?? bestImageUrl(player.currentTrack.album?.images, 120)}
          alt={player.currentTrack.title}
          size={56}
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-base font-semibold text-ink leading-snug hover:underline">
            {player.currentTrack.title}
          </p>
          <p class="truncate text-sm text-ink-muted leading-tight mt-0.5">
            {joinArtists(player.currentTrack.artists)}
          </p>
        </div>
      </a>
      <button
        type="button"
        onclick={() => player.currentTrack && toggleLikeTrack(player.currentTrack, isLiked)}
        class="shrink-0 p-1 text-ink-muted hover:text-accent transition-colors"
        class:text-accent={isLiked}
        aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
        aria-pressed={isLiked}
      >
        <Heart size={18} weight={isLiked ? 'fill' : 'light'} />
      </button>
    {:else}
      <div class="flex min-w-0 flex-1 items-center gap-3 select-none opacity-60">
        <Artwork size={56} alt="No track" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-base font-semibold text-ink-muted leading-snug">
            No track selected
          </p>
          <p class="truncate text-sm text-ink-faint leading-tight mt-0.5">
            —
          </p>
        </div>
      </div>
    {/if}
  </div>

  <!-- Center: Transport controls & Scrubber. This grid column gets the larger 2fr share so it dominates
       the row and stays visually centered (the two 1fr side columns are equal, so this one is always
       exactly centered regardless of how much content each side is showing). min-w-[176px] is the
       transport row's own real minimum (5 icon buttons + their gaps, empirically measured) — the grid
       column would otherwise shrink past that floor and the buttons would overflow, overlapping the
       volume column next to it. Only the Scrubber below has anywhere left to give (its own track is
       separately flex-1), so it does. -->
  <div class="flex min-w-[176px] flex-col items-center justify-center gap-1 px-4">
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
        disabled={!player.hasPrevious}
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
        disabled={!player.hasNext}
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
        disabled={!player.currentTrack}
        onseek={(s) => player.seek(s)}
        onscrubend={(s) => player.commitSeek(s)}
        size="sm"
        showTime={true}
      />
    </div>
  </div>

  <!-- Right: Quality badge, secondary toggles & volume. The mirror 1fr column to the left one, so the
       center column above always lands exactly centered. min-w-[120px] is its own real minimum (mute
       button + slider, empirically measured) — same overlap risk as the center column above otherwise.
       The two lower-priority controls (quality readout, Lyrics/Up-next toggles — both reachable from the
       full Now Playing page regardless) step out of the way first, before mute+volume itself, the
       essential control here, would otherwise get pushed off-screen. justify-end keeps them pinned to
       the page's right edge; the fr column takes care of how much room they get to do that in. -->
  <div class="flex min-w-[120px] items-center justify-end gap-3">
    {#if player.currentAudio}
      <div class="hidden xl:block">
        <QualityBadge audio={player.currentAudio} />
      </div>
    {/if}

    <div class="hidden lg:flex items-center gap-1">
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
    <div class="flex items-center gap-1.5 pl-1 shrink-0">
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
