<script lang="ts">
let { size = 20, ...rest }: { size?: number; [key: string]: unknown } = $props();
</script>

<!-- Custom transport icons, drawn to match: a slightly asymmetric play triangle (not a generic
     equilateral glyph), consistent 1.6px strokes, filled solids only where a filled solid reads
     better at small sizes (play/pause). No icon-font, no third-party glyph for these five. -->
<svg width={size} height={size} viewBox="0 0 20 20" fill="none" {...rest}>
  <path d="M6.5 4.6c0-.9 1-1.45 1.76-.97l8.2 5.4c.7.46.7 1.48 0 1.94l-8.2 5.4c-.76.48-1.76-.07-1.76-.97V4.6Z" fill="currentColor" />
</svg>
