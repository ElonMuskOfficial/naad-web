<script lang="ts">
import { formatBitrate } from '$lib/format';
import type { Audio } from '$lib/types';
import QualityBadge from './QualityBadge.svelte';

interface Props {
  audio: Audio | null;
}

let { audio }: Props = $props();
</script>

<div class="flex flex-col gap-6 p-6 rounded-sm border border-border bg-surface-1 select-none">
  <!-- Header: Hi-fi panel styling -->
  <div class="flex items-center justify-between pb-4 border-b border-border">
    <div>
      <p class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Technical Readout</p>
      <h2 class="text-base font-semibold text-ink mt-0.5 tracking-tight">Signal Path</h2>
    </div>
    {#if audio}
      <QualityBadge {audio} interactive={false} />
    {/if}
  </div>

  {#if audio}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="flex flex-col gap-1 p-3 rounded-xs border border-border bg-surface-2">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-muted">Codec & Container</span>
        <span class="font-mono text-sm text-ink uppercase">
          {audio.codec} <span class="text-ink-muted font-normal text-xs">({audio.mimeType})</span>
        </span>
      </div>

      <div class="flex flex-col gap-1 p-3 rounded-xs border border-border bg-surface-2">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-muted">Stream Bitrate</span>
        <span class="font-mono text-sm text-ink" data-numeric>
          {formatBitrate(audio.bitrateKbps)}
        </span>
      </div>
    </div>
  {:else}
    <div class="py-8 text-center text-xs text-ink-muted">
      No technical source stream resolved for the current track.
    </div>
  {/if}
</div>
