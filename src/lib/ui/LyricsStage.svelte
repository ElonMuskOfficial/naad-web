<script lang="ts">
import { createLyricsQuery } from '$lib/queries';
import EmptyState from './EmptyState.svelte';
import Skeleton from './Skeleton.svelte';

interface Props {
  trackId: string;
  currentTime: number; // in seconds
  onseek?: (seconds: number) => void;
  size?: 'sm' | 'md';
}

let { trackId, currentTime, onseek, size = 'md' }: Props = $props();

const lyricsQuery = createLyricsQuery(() => trackId);

let containerEl = $state<HTMLElement>();
let userScrollTimeout: ReturnType<typeof setTimeout> | null = null;
let isUserScrolling = $state(false);

// Filter to non-empty synced lines
const validLines = $derived.by(() => {
  const synced = lyricsQuery.data?.synced;
  if (!synced || synced.length === 0) return [];
  return synced.filter((l) => l.text && l.text.trim().length > 0);
});

// Spotify-style active line determination based on track currentTime
const activeIndex = $derived.by(() => {
  if (validLines.length === 0) return -1;
  const currentMs = currentTime * 1000;
  let best = -1;
  for (let i = 0; i < validLines.length; i++) {
    if (validLines[i]!.timeMs <= currentMs) {
      best = i;
    } else {
      break;
    }
  }
  return best;
});

// Smoothly scroll active line to center unless user is manually browsing
$effect(() => {
  if (activeIndex >= 0 && !isUserScrolling && containerEl) {
    const activeEl = containerEl.querySelector(`[data-line-idx="${activeIndex}"]`) as HTMLElement | null;
    if (activeEl) {
      const targetTop = activeEl.offsetTop - containerEl.clientHeight / 2 + activeEl.clientHeight / 2;
      containerEl.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    }
  }
});

function handleScroll() {
  isUserScrolling = true;
  if (userScrollTimeout) clearTimeout(userScrollTimeout);
  userScrollTimeout = setTimeout(() => {
    isUserScrolling = false;
  }, 4000);
}
</script>

<div
  bind:this={containerEl}
  onscroll={handleScroll}
  class="relative h-full w-full max-w-full overflow-y-auto overflow-x-hidden select-none focus:outline-none {size === 'sm' ? 'px-3 py-4' : 'px-4 py-8'}"
  role="region"
  aria-label="Lyrics stage"
>
  {#if lyricsQuery.isPending}
    <div class="flex flex-col gap-3 py-6 max-w-lg">
      <Skeleton class="h-5 w-3/4 rounded-xs" />
      <Skeleton class="h-5 w-2/3 rounded-xs" />
      <Skeleton class="h-5 w-5/6 rounded-xs" />
      <Skeleton class="h-5 w-1/2 rounded-xs" />
      <Skeleton class="h-5 w-4/5 rounded-xs" />
    </div>
  {:else if validLines.length > 0}
    <!-- Synced Lyrics Stage (Spotify-style line-by-line sync) -->
    <div class="flex flex-col w-full max-w-full {size === 'sm' ? 'gap-3 py-10' : 'gap-4 sm:gap-5 max-w-2xl py-20'}">
      <div class="inline-flex items-center gap-1.5 py-0.5 px-2 rounded-xs border border-border/60 bg-surface-1/80 w-fit text-ink-muted mb-1">
        <span class="size-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true"></span>
        <span class="font-mono text-2xs uppercase tracking-wider text-accent font-medium">Time-synced lyrics</span>
      </div>
      {#each validLines as line, idx (line.timeMs)}
        {@const isActive = idx === activeIndex}
        {@const isPast = idx < activeIndex}

        <button
          type="button"
          data-line-idx={idx}
          onclick={() => onseek?.(line.timeMs / 1000)}
          class="w-full max-w-full text-left font-sans transition-colors duration-200 leading-snug cursor-pointer focus-visible:outline-none select-none break-words"
          class:text-ink={isActive}
          class:font-semibold={isActive}
          class:text-ink-muted={isPast}
          class:text-ink-faint={!isActive && !isPast}
          class:hover:text-ink={!isActive}
          class:text-base={size === 'sm'}
          class:text-lg={size === 'md' && !isActive}
          class:sm:text-xl={size === 'md' && !isActive}
          class:text-xl={size === 'md' && isActive}
          class:sm:text-2xl={size === 'md' && isActive}
        >
          {line.text}
        </button>
      {/each}
    </div>
  {:else}
    <!-- Quiet Empty State when there are no synced lyrics or track has no lyrics -->
    <div class="py-12">
      <EmptyState
        title="No lyrics found"
        description="Synced lyrics have not been indexed for this recording."
      />
    </div>
  {/if}
</div>
