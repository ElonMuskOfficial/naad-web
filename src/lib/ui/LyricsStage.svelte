<script lang="ts">
import { createLyricsQuery } from '$lib/queries';
import EmptyState from './EmptyState.svelte';
import Skeleton from './Skeleton.svelte';

interface Props {
  trackId: string;
  currentTime: number; // in seconds
  onseek?: (seconds: number) => void;
}

let { trackId, currentTime, onseek }: Props = $props();

const lyricsQuery = createLyricsQuery(() => trackId);

let containerEl = $state<HTMLElement>();
let userScrollTimeout: ReturnType<typeof setTimeout> | null = null;
let isUserScrolling = $state(false);

const activeIndex = $derived.by(() => {
  const synced = lyricsQuery.data?.synced;
  if (!synced || synced.length === 0) return -1;
  const currentMs = currentTime * 1000;
  let bestIdx = -1;
  for (let i = 0; i < synced.length; i++) {
    if (synced[i]!.timeMs <= currentMs) {
      bestIdx = i;
    } else {
      break;
    }
  }
  return bestIdx;
});

$effect(() => {
  if (activeIndex >= 0 && !isUserScrolling && containerEl) {
    const activeEl = containerEl.querySelector(`[data-line-idx="${activeIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});

function handleScroll() {
  isUserScrolling = true;
  if (userScrollTimeout) clearTimeout(userScrollTimeout);
  userScrollTimeout = setTimeout(() => {
    isUserScrolling = false;
  }, 3500);
}
</script>

<div
  bind:this={containerEl}
  onscroll={handleScroll}
  class="relative h-full overflow-y-auto px-4 py-8 select-none focus:outline-none"
  role="region"
  aria-label="Lyrics stage"
>
  {#if lyricsQuery.isPending}
    <div class="flex flex-col gap-4 py-8 max-w-lg">
      <Skeleton class="h-6 w-3/4 rounded-xs" />
      <Skeleton class="h-6 w-2/3 rounded-xs" />
      <Skeleton class="h-6 w-5/6 rounded-xs" />
      <Skeleton class="h-6 w-1/2 rounded-xs" />
      <Skeleton class="h-6 w-4/5 rounded-xs" />
    </div>
  {:else if lyricsQuery.isError}
    <div class="py-12 text-center text-sm text-ink-muted">
      Unable to load lyrics for this track.
    </div>
  {:else if lyricsQuery.data?.synced && lyricsQuery.data.synced.length > 0}
    <!-- Synced Lyrics Stage -->
    <div class="flex flex-col gap-5 max-w-2xl py-24">
      {#each lyricsQuery.data.synced as line, idx (line.timeMs)}
        {@const isActive = idx === activeIndex}
        {@const isPast = idx < activeIndex}
        <!-- Only render lines with text -->
        {#if line.text.trim().length > 0}
          <button
            type="button"
            data-line-idx={idx}
            onclick={() => onseek?.(line.timeMs / 1000)}
            class="text-left font-sans text-xl sm:text-2xl transition-all duration-300 leading-relaxed cursor-pointer focus-visible:outline-none"
            class:text-ink={isActive}
            class:font-semibold={isActive}
            class:scale-[1.02]={isActive}
            class:text-ink-muted={isPast}
            class:text-ink-faint={!isActive && !isPast}
            class:hover:text-ink={!isActive}
          >
            {line.text}
          </button>
        {/if}
      {/each}
    </div>
  {:else if lyricsQuery.data?.plain}
    <!-- Plain Static Lyrics Fallback -->
    <div class="max-w-2xl py-12">
      <p class="font-sans text-lg sm:text-xl text-ink leading-relaxed whitespace-pre-line">
        {lyricsQuery.data.plain}
      </p>
    </div>
  {:else}
    <!-- Quiet Empty State -->
    <div class="py-16">
      <EmptyState
        title="No lyrics found"
        description="Synced or plain lyrics have not been indexed for this recording."
      />
    </div>
  {/if}
</div>
