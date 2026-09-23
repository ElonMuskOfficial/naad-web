<script lang="ts">
import { goto } from '$app/navigation';
import { describeQuality, type Tier } from '$lib/format';

interface Props {
  source: {
    tier: Tier;
    codec: string;
    bitDepth?: number | null;
    sampleRate?: number | null;
    bitrateKbps?: number | null;
  };
  /** Renders as a plain <span> instead of a <button> (e.g. inside a row that's already clickable). */
  interactive?: boolean;
  onclick?: () => void;
}

let { source, interactive = true, onclick }: Props = $props();
const info = $derived(describeQuality(source));

// The dot is the only place tier gets a colour: amber for the thing we're proudest of, a plain
// ink dot for everything else. No traffic-light red/yellow/green, no filled pill background.
const dot = $derived(info.tier === 'hires' ? 'bg-accent' : 'bg-ink-faint');
</script>

{#snippet content()}
  <span class="size-[5px] rounded-full {dot}" aria-hidden="true"></span>
  <span class="font-mono text-2xs uppercase tracking-wide" data-numeric>{info.label}</span>
{/snippet}

{#if interactive}
  <button
    type="button"
    onclick={onclick ?? (() => goto('/now-playing?tab=signal'))}
    class="inline-flex items-center gap-1.5 border-b border-transparent text-ink-muted hover:border-border-strong hover:text-ink transition-colors duration-[var(--duration-fast)]"
    aria-label="Playback quality: {info.detail}. View signal path."
  >
    {@render content()}
  </button>
{:else}
  <span class="inline-flex items-center gap-1.5 text-ink-muted" aria-label="Playback quality: {info.detail}">
    {@render content()}
  </span>
{/if}
