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
  onplay?: () => void;
}

let { href, title, subtitle, image, shape = 'square', size = 148, rank, onplay }: Props = $props();
</script>

<a
  {href}
  class="group relative flex shrink-0 flex-col gap-2 rounded-xs p-1 -m-1 hover:bg-surface-2 transition-colors duration-[var(--duration-fast)]"
  style:width="{size}px"
>
  <div class="relative">
    <Artwork src={image} alt="" {size} radius={shape === 'circle' ? 'full' : 'sm'} />
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
