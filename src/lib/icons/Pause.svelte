<script lang="ts">
let { size = 20, ...rest }: { size?: number; [key: string]: unknown } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 20 20" fill="none" {...rest}>
  <rect x="5.5" y="4" width="3" height="12" rx="1" fill="currentColor" />
  <rect x="11.5" y="4" width="3" height="12" rx="1" fill="currentColor" />
</svg>
