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

function handleWheel(e: WheelEvent) {
  if (!scrollerEl) return;
  // If user is scrolling vertically over horizontal shelf, convert to horizontal scroll smoothly
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY !== 0) {
    const maxScroll = scrollerEl.scrollWidth - scrollerEl.clientWidth;
    const isAtStart = scrollerEl.scrollLeft <= 0;
    const isAtEnd = scrollerEl.scrollLeft >= maxScroll;

    if ((e.deltaY > 0 && !isAtEnd) || (e.deltaY < 0 && !isAtStart)) {
      e.preventDefault();
      scrollerEl.scrollLeft += e.deltaY;
      updateScrollButtons();
    }
  }
}

function scrollByAmount(direction: -1 | 1) {
  if (!scrollerEl) return;
  const cardWidth = 320;
  scrollerEl.scrollBy({ left: direction * cardWidth * 1.5, behavior: 'smooth' });
}

let isPointerDown = $state(false);
let startX = 0;
let startScrollLeft = 0;
let hasMoved = $state(false);

function handlePointerDown(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || e.button !== 0 || !scrollerEl) return;
  isPointerDown = true;
  hasMoved = false;
  startX = e.pageX;
  startScrollLeft = scrollerEl.scrollLeft;
}

function handlePointerMove(e: PointerEvent) {
  if (!isPointerDown || !scrollerEl) return;
  const dx = e.pageX - startX;
  if (Math.abs(dx) > 6) {
    hasMoved = true;
  }
  scrollerEl.scrollLeft = startScrollLeft - dx;
  updateScrollButtons();
}

function handlePointerUp() {
  isPointerDown = false;
}

function handleClickCapture(e: MouseEvent) {
  if (hasMoved) {
    e.stopPropagation();
    e.preventDefault();
    hasMoved = false;
  }
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
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={scrollerEl}
    onscroll={updateScrollButtons}
    onwheel={handleWheel}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    onclickcapture={handleClickCapture}
    class="flex gap-4 overflow-x-auto pb-1 pl-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-x-contain will-change-[scroll-position]"
    class:cursor-grab={!isPointerDown}
    class:cursor-grabbing={isPointerDown}
  >
    {@render children()}
  </div>
</section>
