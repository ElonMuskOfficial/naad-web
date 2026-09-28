<script lang="ts">
import { CROSSFADE_STORAGE_KEY, player } from '$lib/player/engine.svelte';
import { theme } from '$lib/theme.svelte';
import { toast } from '$lib/toast.svelte';
import Button from '$lib/ui/Button.svelte';

// Stored settings
let crossfade = $state(player.crossfadeSeconds);

function handleCrossfadeChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const val = Number(target.value);
  crossfade = val;
  player.setCrossfade(val);
}

function handleClearLocalData() {
  if (
    typeof confirm !== 'undefined' &&
    !confirm(
      'Clear the settings and saved session stored in this browser? Your library (liked songs, playlists, history) is stored on the server and is not affected.',
    )
  ) {
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  crossfade = 0;
  player.setCrossfade(0);
  toast.push('Local settings cleared. Your library on the server is untouched.');
}
</script>

<svelte:head>
  <title>Settings · NAAD</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
  <!-- Header -->
  <header class="mb-8 border-b border-border pb-6">
    <p class="font-mono text-2xs uppercase tracking-wider text-accent mb-2">Configuration</p>
    <h1 class="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
      Settings
    </h1>
    <p class="mt-2 text-sm text-ink-muted max-w-xl">
      Audio processing and UI appearance. Playback always uses the best quality JioSaavn has (up to 320 kbps AAC).
    </p>
  </header>

  <div class="space-y-8">
    <!-- SECTION 1: Audio Processing (Crossfade) -->
    <section class="rounded-sm border border-border bg-surface-1 p-6 space-y-6">
      <div class="border-b border-border pb-3">
        <h2 class="text-base font-semibold text-ink">Signal Processing</h2>
        <p class="text-xs text-ink-muted mt-0.5">
          Track boundary transitions.
        </p>
      </div>

      <!-- Crossfade Slider -->
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-medium text-ink">Crossfade Duration</span>
          <span class="font-mono text-accent" data-numeric>
            {crossfade === 0 ? '0s (Gapless handoff)' : `${crossfade} seconds`}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="12"
          step="1"
          value={crossfade}
          oninput={handleCrossfadeChange}
          class="w-full accent-accent h-1.5 bg-surface-3 rounded-xs cursor-pointer"
        />
        <div class="flex justify-between text-[10px] font-mono text-ink-faint">
          <span>0s (Off)</span>
          <span>4s</span>
          <span>8s</span>
          <span>12s</span>
        </div>
        <p class="text-[11px] text-ink-faint mt-1">
          Crossfade is automatically skipped between consecutive tracks of the same album to preserve continuous playback.
        </p>
      </div>
    </section>

    <!-- SECTION 2: Appearance & Interface -->
    <section class="rounded-sm border border-border bg-surface-1 p-6 space-y-5">
      <div class="border-b border-border pb-3">
        <h2 class="text-base font-semibold text-ink">Appearance & Theme</h2>
        <p class="text-xs text-ink-muted mt-0.5">
          Select between Dark (warm near-black #141312) and Light (paper palette #F4F1EA).
        </p>
      </div>

      <div class="grid grid-cols-2 gap-4 max-w-sm">
        <button
          type="button"
          onclick={() => theme.set('dark')}
          class="flex flex-col items-center gap-2 p-4 rounded-xs border transition-colors {theme.current === 'dark'
            ? 'border-accent bg-accent/10 text-ink'
            : 'border-border bg-surface-0 hover:bg-surface-2 text-ink-muted'}"
        >
          <div class="size-8 rounded-xs bg-[#141312] border border-[#2a2824]"></div>
          <span class="text-xs font-medium {theme.current === 'dark' ? 'text-accent' : 'text-ink'}">Dark Theme</span>
          <span class="text-[10px] font-mono text-ink-faint">Warm Near-Black</span>
        </button>

        <button
          type="button"
          onclick={() => theme.set('light')}
          class="flex flex-col items-center gap-2 p-4 rounded-xs border transition-colors {theme.current === 'light'
            ? 'border-accent bg-accent/10 text-ink'
            : 'border-border bg-surface-0 hover:bg-surface-2 text-ink-muted'}"
        >
          <div class="size-8 rounded-xs bg-[#F4F1EA] border border-[#d6d0c4]"></div>
          <span class="text-xs font-medium {theme.current === 'light' ? 'text-accent' : 'text-ink'}">Light Theme</span>
          <span class="text-[10px] font-mono text-ink-faint">Paper Palette</span>
        </button>
      </div>
    </section>

    <!-- SECTION 3: Maintenance & Local Storage -->
    <section class="rounded-sm border border-border bg-surface-1 p-6 space-y-4">
      <div class="border-b border-border pb-3">
        <h2 class="text-base font-semibold text-ink">Storage & Cache</h2>
        <p class="text-xs text-ink-muted mt-0.5">
          Reset client preferences and clear browser cache.
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-4">
        <p class="text-xs text-ink-muted max-w-md">
          Clearing local data will remove your audio preferences and queue cache.
        </p>
        <Button variant="danger" size="sm" onclick={handleClearLocalData}>
          Clear Local Data
        </Button>
      </div>
    </section>
  </div>
</div>
