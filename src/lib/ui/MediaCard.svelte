<script lang="ts">
import Play from 'phosphor-svelte/lib/Play';
import Artwork from './Artwork.svelte';

interface Props {
  href: string;
  title: string;
  subtitle?: string;
  image?: string | null;
  shape?: 'square' | 'circle';
  size?: number;
  rank?: number; // shows a large mono rank number for chart shelves
  /** Fills its grid column instead of a fixed size×size box — for a CSS Grid of cards (search/library/
   *  artist results), whose column width varies by breakpoint, rather than Shelf's horizontally-scrolling
   *  row, where a fixed card width is what makes the scrolling meaningful in the first place. Without
   *  this, a grid card doesn't shrink with its column at low column counts — the grid ends up wider than
   *  its container, and the last card(s) per row get clipped. `size` still sets the artwork's own
   *  requested resolution either way. */
  fluid?: boolean;
  onplay?: () => void;
}

let {
  href,
  title,
  subtitle,
  image,
  shape = 'square',
  size = 148,
  rank,
  fluid = false,
  onplay,
}: Props = $props();
</script>

<a
  {href}
  class="group relative flex shrink-0 flex-col gap-2 rounded-xs p-1 -m-1 hover:bg-surface-2 transition-colors duration-[var(--duration-fast)] {fluid ? 'w-full' : ''}"
  style:width={fluid ? undefined : `${size}px`}
>
  <div class="relative">
    <Artwork src={image} alt="" {size} {fluid} radius={shape === 'circle' ? 'full' : 'sm'} />
    {#if onplay}
      <button
        type="button"
        onclick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onplay?.();
        }}
        class="absolute bottom-1.5 right-1.5 flex size-9 items-center justify-center rounded-full bg-accent text-accent-ink opacity-0 translate-y-1 shadow-float transition-all duration-[var(--duration-fast)] ease-[var(--ease-signal)] group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100"
        aria-label="Play {title}"
      >
        <Play size={16} weight="fill" />
      </button>
    {/if}
    {#if rank}
      <span
        class="absolute -left-1 -top-2 font-display text-3xl leading-none text-ambient-1 [-webkit-text-stroke:1.5px_var(--color-border-strong)]"
        aria-hidden="true"
      >
        {rank}
      </span>
    {/if}
  </div>
  <div class="min-w-0">
    <p class="truncate text-sm font-medium text-ink">{title}</p>
    {#if subtitle}<p class="truncate text-xs text-ink-muted">{subtitle}</p>{/if}
  </div>
</a>
