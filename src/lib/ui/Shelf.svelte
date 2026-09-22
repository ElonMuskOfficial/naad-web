<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  title: string;
  subtitle?: string;
  href?: string; // "See all" — only shown when the shelf can be expanded into a full page
  children: Snippet;
}

let { title, subtitle, href, children }: Props = $props();
</script>

<section class="min-w-0">
  <div class="mb-3 flex items-baseline justify-between gap-4 px-1">
    <div class="min-w-0">
      <h2 class="truncate text-md font-medium text-ink">{title}</h2>
      {#if subtitle}<p class="text-xs text-ink-muted">{subtitle}</p>{/if}
    </div>
    {#if href}
      <a href={href} class="shrink-0 text-xs text-ink-muted hover:text-ink hover:underline">See all</a>
    {/if}
  </div>
  <div class="flex gap-4 overflow-x-auto pb-1 pl-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {@render children()}
  </div>
</section>
