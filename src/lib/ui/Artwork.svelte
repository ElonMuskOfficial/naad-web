<script lang="ts">
import { artUrl } from '$lib/art';

interface Props {
  src?: string | null;
  alt: string;
  size?: number; // px — the rendered box in the default fixed mode, and always the resolution requested
  // from the image proxy (fluid or not: a wider rendered box still only needs so much real detail).
  radius?: 'sm' | 'full'; // 'full' for artist circles
  /** Fills its container's width (aspect-square) instead of a fixed size×size box — for a card in a CSS
   *  Grid, whose column width varies by breakpoint, rather than a fixed-size context like a Shelf's
   *  horizontally-scrolling row or a track list's fixed-size thumbnail. */
  fluid?: boolean;
  class?: string;
}

let { src, alt, size = 48, radius = 'sm', fluid = false, class: className = '' }: Props = $props();
let failed = $state(false);
const proxiedSrc = $derived(src ? artUrl(src, size) : undefined);
const rounded = $derived(radius === 'full' ? 'rounded-full' : 'rounded-sm');
</script>

<div
  class="artwork-root relative shrink-0 overflow-hidden {rounded} bg-surface-2 {className}"
  class:artwork-fluid={fluid}
  style:--art-size={fluid ? undefined : `${size}px`}
>
  {#if proxiedSrc && !failed}
    <img
      src={proxiedSrc}
      {alt}
      loading="lazy"
      decoding="async"
      class="size-full object-cover"
      onerror={() => (failed = true)}
    />
  {:else}
    <!-- On-brand fallback: a vinyl label suggestion in two hairline rings, not a stock icon. Proportions
         in % when fluid (size isn't the rendered box there), px otherwise. -->
    <div class="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div
        class="rounded-full border border-border-strong"
        style:width={fluid ? '62%' : `${size * 0.62}px`}
        style:height={fluid ? '62%' : `${size * 0.62}px`}
      ></div>
      <div
        class="absolute rounded-full bg-border-strong"
        style:width={fluid ? '6%' : `${Math.max(3, size * 0.06)}px`}
        style:height={fluid ? '6%' : `${Math.max(3, size * 0.06)}px`}
      ></div>
    </div>
    <span class="sr-only">{alt}</span>
  {/if}
</div>

<style>
  .artwork-root {
    width: var(--art-size);
    height: var(--art-size);
  }
  .artwork-fluid {
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;
  }
</style>
