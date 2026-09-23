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

interface ProcessedLine {
  originalIndex: number;
  timeMs: number;
  durationMs: number;
  text: string;
  words: {
    word: string;
    startFrac: number;
    endFrac: number;
  }[];
}

// Filter to non-empty lines and compute word-level interpolation boundaries
const validLines = $derived.by<ProcessedLine[]>(() => {
  const synced = lyricsQuery.data?.synced;
  if (!synced || synced.length === 0) return [];

  const rawLines = synced.filter((l) => l.text && l.text.trim().length > 0);
  return rawLines.map((line, idx) => {
    const nextLine = rawLines[idx + 1];
    // Default 4.5s if last line or gap is out of range
    const nextTime = nextLine ? nextLine.timeMs : line.timeMs + 4500;
    const durationMs = Math.max(800, Math.min(12000, nextTime - line.timeMs));

    // Split words by whitespace
    const rawWords = line.text.trim().split(/\s+/);
    const weights = rawWords.map((w) => Math.max(w.length, 2));
    const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1;

    let accum = 0;
    const words = rawWords.map((word, i) => {
      const startFrac = accum / totalWeight;
      accum += weights[i]!;
      const endFrac = accum / totalWeight;
      return { word, startFrac, endFrac };
    });

    return {
      originalIndex: idx,
      timeMs: line.timeMs,
      durationMs,
      text: line.text,
      words,
    };
  });
});

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

// Active line progress from 0 to 1
const activeLineProgress = $derived.by(() => {
  if (activeIndex < 0 || activeIndex >= validLines.length) return 0;
  const line = validLines[activeIndex]!;
  const currentMs = currentTime * 1000;
  const elapsed = currentMs - line.timeMs;
  return Math.max(0, Math.min(1, elapsed / line.durationMs));
});

$effect(() => {
  if (activeIndex >= 0 && !isUserScrolling && containerEl) {
    const activeEl = containerEl.querySelector(`[data-line-idx="${activeIndex}"]`) as HTMLElement | null;
    if (activeEl) {
      // Direct container scroll to strictly avoid bubbling scroll into parent layouts
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
  {:else if validLines.length > 0}
    <!-- Synced Lyrics Stage with Word-by-Word Karaoke Highlighting -->
    <div class="flex flex-col gap-6 max-w-2xl py-32">
      {#each validLines as line, idx (line.timeMs)}
        {@const isActive = idx === activeIndex}
        {@const isPast = idx < activeIndex}
        {@const isFuture = idx > activeIndex}

        <button
          type="button"
          data-line-idx={idx}
          onclick={() => onseek?.(line.timeMs / 1000)}
          class="text-left font-sans transition-all duration-300 leading-relaxed cursor-pointer focus-visible:outline-none py-1 group/line select-none"
          class:text-2xl={isActive}
          class:sm:text-3xl={isActive}
          class:font-semibold={isActive}
          class:scale-[1.02]={isActive}
          class:text-xl={!isActive}
          class:sm:text-2xl={!isActive}
          class:opacity-50={isPast}
          class:hover:opacity-100={!isActive}
          class:opacity-30={isFuture}
        >
          {#if isActive}
            <!-- Word-level highlight for active line -->
            <span class="inline-flex flex-wrap gap-x-2 gap-y-1">
              {#each line.words as w, wIdx (wIdx)}
                {@const isWordSung = activeLineProgress >= w.endFrac}
                {@const isWordSinging = activeLineProgress >= w.startFrac && activeLineProgress < w.endFrac}
                <span
                  class="transition-all duration-150 inline-block"
                  class:text-ink={isWordSung}
                  class:font-bold={isWordSinging}
                  class:text-accent={isWordSinging}
                  class:scale-[1.05]={isWordSinging}
                  class:drop-shadow-[0_0_12px_rgba(244,63,94,0.45)]={isWordSinging}
                  class:text-ink-muted={!isWordSung && !isWordSinging}
                  class:opacity-40={!isWordSung && !isWordSinging}
                >
                  {w.word}
                </span>
              {/each}
            </span>
          {:else}
            <!-- Inactive lines (past or upcoming) -->
            <span class="text-inherit">
              {line.text}
            </span>
          {/if}
        </button>
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
