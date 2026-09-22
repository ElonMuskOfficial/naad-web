<script lang="ts">
let {
  size = 20,
  mode = 'all',
  ...rest
}: { size?: number; mode?: 'all' | 'one'; [key: string]: unknown } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" {...rest}>
  <path d="M5.5 6.5h7a3 3 0 0 1 3 3V11" />
  <path d="M7 4 4.7 6.3 7 8.6" />
  <path d="M14.5 13.5h-7a3 3 0 0 1-3-3V9" />
  <path d="M13 16l2.3-2.3L13 11.4" />
  {#if mode === 'one'}
    <path d="M10 8.5v3" stroke-width="1.4" />
    <path d="M9.3 9.2 10 8.5v3" stroke-width="1.4" />
  {/if}
</svg>
