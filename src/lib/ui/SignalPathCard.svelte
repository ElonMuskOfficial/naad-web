<script lang="ts">
import { formatBitrate, formatSampleRate } from '$lib/format';
import type { Source } from '$lib/types';
import QualityBadge from './QualityBadge.svelte';

interface Props {
  selectedSource: Source | null;
  alternatives?: Source[];
}

let { selectedSource, alternatives = [] }: Props = $props();

function formatDelivery(d?: string): string {
  if (d === 'redirect') return 'Direct CDN Redirect (Zero Engine Bandwidth)';
  if (d === 'proxy') return 'Same-Origin Stream Proxy';
  if (d === 'materialize') return 'Materialized Disk Stream (yt-dlp)';
  return d ?? 'Direct Stream';
}

function formatNormalization(norm?: Source['normalization']): string {
  if (!norm) return 'None (0.0 dB attenuation)';
  const gainStr = `${norm.gainDb > 0 ? '+' : ''}${norm.gainDb.toFixed(2)} dB`;
  const lufsStr = norm.lufs != null ? ` (Loudness: ${norm.lufs.toFixed(1)} LUFS)` : '';
  return `${gainStr}${lufsStr}`;
}
</script>

<div class="flex flex-col gap-6 p-6 rounded-sm border border-border bg-surface-1 select-none">
  <!-- Header: Hi-fi panel styling -->
  <div class="flex items-center justify-between pb-4 border-b border-border">
    <div>
      <p class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Technical Readout</p>
      <h2 class="text-base font-semibold text-ink mt-0.5 tracking-tight">Signal Path & Source Chain</h2>
    </div>
    {#if selectedSource}
      <QualityBadge source={selectedSource} interactive={false} />
    {/if}
  </div>

  {#if selectedSource}
    <!-- Specifications Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="flex flex-col gap-1 p-3 rounded-xs border border-border bg-surface-2">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-muted">Catalog Provider</span>
        <span class="font-medium text-sm text-ink capitalize">{selectedSource.provider}</span>
      </div>

      <div class="flex flex-col gap-1 p-3 rounded-xs border border-border bg-surface-2">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-muted">Quality Tier</span>
        <span class="font-mono text-sm text-ink uppercase" class:text-accent={selectedSource.tier === 'hires'}>
          {selectedSource.tier}
        </span>
      </div>

      <div class="flex flex-col gap-1 p-3 rounded-xs border border-border bg-surface-2">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-muted">Codec & Container</span>
        <span class="font-mono text-sm text-ink uppercase">
          {selectedSource.codec} <span class="text-ink-muted font-normal text-xs">({selectedSource.mimeType})</span>
        </span>
      </div>

      <div class="flex flex-col gap-1 p-3 rounded-xs border border-border bg-surface-2">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-muted">Bit Depth & Sample Rate</span>
        <span class="font-mono text-sm text-ink" data-numeric>
          {selectedSource.bitDepth ? `${selectedSource.bitDepth}-bit / ` : ''}
          {formatSampleRate(selectedSource.sampleRate)}
        </span>
      </div>

      <div class="flex flex-col gap-1 p-3 rounded-xs border border-border bg-surface-2">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-muted">Stream Bitrate</span>
        <span class="font-mono text-sm text-ink" data-numeric>
          {formatBitrate(selectedSource.bitrateKbps)}
        </span>
      </div>

      <div class="flex flex-col gap-1 p-3 rounded-xs border border-border bg-surface-2">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-muted">Delivery Protocol</span>
        <span class="text-sm text-ink">{formatDelivery(selectedSource.delivery)}</span>
      </div>

      <div class="flex flex-col gap-1 p-3 rounded-xs border border-border bg-surface-2 sm:col-span-2">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-muted">Normalization Calibration</span>
        <span class="font-mono text-sm text-ink" data-numeric>
          {formatNormalization(selectedSource.normalization)}
        </span>
      </div>

      <div class="flex flex-col gap-1 p-3 rounded-xs border border-border bg-surface-2 sm:col-span-2">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-muted">Source Verified At</span>
        <span class="font-mono text-xs text-ink-muted" data-numeric>
          {selectedSource.verifiedAt}
        </span>
      </div>
    </div>

    <!-- Alternatives List -->
    {#if alternatives && alternatives.length > 0}
      <div class="mt-2 flex flex-col gap-2 pt-4 border-t border-border">
        <p class="font-mono text-2xs uppercase tracking-wider text-ink-faint">
          Fallback & Alternative Sources ({alternatives.length})
        </p>
        <div class="flex flex-col gap-2">
          {#each alternatives as alt, idx (alt.id ?? idx)}
            <div class="flex items-center justify-between p-2.5 rounded-xs border border-border bg-surface-2 text-xs">
              <div class="flex items-center gap-2">
                <span class="font-mono text-ink-muted" data-numeric>#{idx + 1}</span>
                <span class="font-medium text-ink capitalize">{alt.provider}</span>
                <span class="font-mono text-ink-muted">({alt.codec.toUpperCase()})</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="font-mono text-ink-muted" data-numeric>{formatBitrate(alt.bitrateKbps)}</span>
                <QualityBadge source={alt} interactive={false} />
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {:else}
    <div class="py-8 text-center text-xs text-ink-muted">
      No technical source stream resolved for the current track.
    </div>
  {/if}
</div>
