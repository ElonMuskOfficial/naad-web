<script lang="ts">
let { size = 20, ...rest }: { size?: number; [key: string]: unknown } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" {...rest}>
  <path d="M3 6h3.4c1.5 0 2.9.8 3.7 2.1l.2.3" />
  <path d="M3 14h3.4c1.5 0 2.9-.8 3.7-2.1l2.4-3.8C13.3 6.8 14.7 6 16.2 6H17" />
  <path d="M14.4 4l2.6 2-2.6 2" />
  <path d="M10.4 11.6 12 14.2c.8 1.3 2.2 2.1 3.7 2.1H17" />
  <path d="M14.4 12.8l2.6 2-2.6 2" />
</svg>
