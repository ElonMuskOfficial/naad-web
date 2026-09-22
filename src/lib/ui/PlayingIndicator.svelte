<script lang="ts">
let { playing = true }: { playing?: boolean } = $props();
</script>

<!-- The "this is playing right now" glyph: three bars, not a generic dot or checkmark. -->
<span class="inline-flex h-3 items-end gap-[2px]" aria-hidden="true">
  {#each [0, 1, 2] as i (i)}
    <span
      class="w-[2.5px] rounded-full bg-accent"
      class:animate-eq={playing}
      style:animation-delay="{i * 0.18}s"
      style:height={playing ? undefined : '3px'}
    ></span>
  {/each}
</span>

<style>
  .animate-eq {
    animation: eq 0.9s ease-in-out infinite;
  }
  @keyframes eq {
    0%,
    100% {
      height: 3px;
    }
    50% {
      height: 12px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .animate-eq {
      animation: none;
      height: 8px;
    }
  }
</style>
