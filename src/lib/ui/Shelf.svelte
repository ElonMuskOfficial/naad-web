<script lang="ts">
import type { Snippet } from 'svelte';
import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
import CaretRight from 'phosphor-svelte/lib/CaretRight';

interface Props {
  title: string;
  subtitle?: string;
  href?: string; // "See all" — only shown when the shelf can be expanded into a full page
  children: Snippet;
}

let { title, subtitle, href, children }: Props = $props();

let scrollerEl = $state<HTMLElement>();
let canScrollLeft = $state(false);
let canScrollRight = $state(false);

function updateScrollButtons() {
  if (!scrollerEl) return;
  canScrollLeft = scrollerEl.scrollLeft > 4;
  canScrollRight = scrollerEl.scrollLeft < scrollerEl.scrollWidth - scrollerEl.clientWidth - 4;
}

$effect(() => {
  if (scrollerEl) {
    updateScrollButtons();
  }
});

function scrollByAmount(direction: -1 | 1) {
  if (!scrollerEl) return;
  const cardWidth = 320;
  scrollerEl.scrollBy({ left: direction * cardWidth * 1.5, behavior: 'smooth' });
}
</script>

<section class="group/shelf relative min-w-0">
  <div class="mb-3 flex items-baseline justify-between gap-4 px-1">
    <div class="min-w-0">
      <h2 class="truncate text-md font-medium text-ink">{title}</h2>
      {#if subtitle}<p class="text-xs text-ink-muted">{subtitle}</p>{/if}
    </div>
    <div class="flex items-center gap-2">
      {#if href}
        <a href={href} class="shrink-0 text-xs text-ink-muted hover:text-ink hover:underline">See all</a>
      {/if}
      <div class="hidden sm:flex items-center gap-1 opacity-0 group-hover/shelf:opacity-100 transition-opacity">
        <button
          type="button"
          disabled={!canScrollLeft}
          onclick={() => scrollByAmount(-1)}
          class="size-6 rounded-full border border-border bg-surface-1 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-2 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          aria-label="Previous items"
        >
          <CaretLeft size={12} />
        </button>
        <button
          type="button"
          disabled={!canScrollRight}
          onclick={() => scrollByAmount(1)}
          class="size-6 rounded-full border border-border bg-surface-1 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-2 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          aria-label="Next items"
        >
          <CaretRight size={12} />
        </button>
      </div>
    </div>
  </div>
  <div
    bind:this={scrollerEl}
    onscroll={updateScrollButtons}
    class="flex gap-4 overflow-x-auto pb-1 pl-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  >
    {@render children()}
  </div>
</section>
