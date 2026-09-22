<script lang="ts">
interface Props {
  src?: string | null;
  alt: string;
  size?: number; // px, square
  radius?: 'sm' | 'full'; // 'full' for artist circles
  class?: string;
}

let { src, alt, size = 48, radius = 'sm', class: className = '' }: Props = $props();
let failed = $state(false);
const rounded = $derived(radius === 'full' ? 'rounded-full' : 'rounded-sm');
</script>

<div
  class="relative shrink-0 overflow-hidden {rounded} bg-surface-2 {className}"
  style:width="{size}px"
  style:height="{size}px"
>
  {#if src && !failed}
    <img
      {src}
      {alt}
      loading="lazy"
      decoding="async"
      class="size-full object-cover"
      onerror={() => (failed = true)}
    />
  {:else}
    <!-- On-brand fallback: a vinyl label suggestion in two hairline rings, not a stock icon. -->
    <div class="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div class="rounded-full border border-border-strong" style:width="{size * 0.62}px" style:height="{size * 0.62}px"></div>
      <div class="absolute rounded-full bg-border-strong" style:width="{Math.max(3, size * 0.06)}px" style:height="{Math.max(3, size * 0.06)}px"></div>
    </div>
    <span class="sr-only">{alt}</span>
  {/if}
</div>
