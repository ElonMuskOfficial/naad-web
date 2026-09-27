<script lang="ts">
import { goto } from '$app/navigation';
import { describeQuality } from '$lib/format';
import { player } from '$lib/player/engine.svelte';

interface Props {
  audio: { codec: string; bitrateKbps: number };
  /** Renders as a plain <span> instead of a <button> (e.g. inside a row that's already clickable). */
  interactive?: boolean;
  onclick?: () => void;
}

let { audio, interactive = true, onclick }: Props = $props();
const info = $derived(describeQuality(audio));
</script>

{#snippet content()}
  <span class="size-[5px] rounded-full bg-ink-faint" aria-hidden="true"></span>
  <span class="font-mono text-2xs uppercase tracking-wide" data-numeric>{info.label}</span>
{/snippet}

{#if interactive}
  <button
    type="button"
    onclick={onclick ?? (() => goto(player.currentTrack ? `/now-playing/${player.currentTrack.id}?tab=signal` : '/now-playing?tab=signal'))}
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
