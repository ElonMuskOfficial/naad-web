<script lang="ts">
import { describeQuality } from '$lib/format';

interface Props {
  audio: { codec: string; bitrateKbps: number };
  /** Renders as a clickable button instead of a plain, non-interactive readout. */
  onclick?: () => void;
}

let { audio, onclick }: Props = $props();
const info = $derived(describeQuality(audio));
</script>

{#snippet content()}
  <span class="size-[5px] rounded-full bg-ink-faint" aria-hidden="true"></span>
  <span class="font-mono text-2xs uppercase tracking-wide" data-numeric>{info.label}</span>
{/snippet}

{#if onclick}
  <button
    type="button"
    {onclick}
    class="inline-flex items-center gap-1.5 border-b border-transparent text-ink-muted hover:border-border-strong hover:text-ink transition-colors duration-[var(--duration-fast)]"
    aria-label="Playback quality: {info.detail}"
  >
    {@render content()}
  </button>
{:else}
  <span class="inline-flex items-center gap-1.5 text-ink-muted" aria-label="Playback quality: {info.detail}">
    {@render content()}
  </span>
{/if}
