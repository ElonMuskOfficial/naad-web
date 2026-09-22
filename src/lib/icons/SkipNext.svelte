<script lang="ts">
let { size = 20, ...rest }: { size?: number; [key: string]: unknown } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 20 20" fill="none" {...rest}>
  <path d="M5.5 4.9c0-.86.95-1.38 1.68-.93l6.6 4.1V4.75a.75.75 0 0 1 1.5 0v10.5a.75.75 0 0 1-1.5 0v-3.32l-6.6 4.1c-.73.45-1.68-.07-1.68-.93V4.9Z" fill="currentColor" />
</svg>
