<script lang="ts">
import { goto } from '$app/navigation';
import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
import { api } from '$lib/api/client';
import { createImportStatusQuery } from '$lib/queries';
import { toast } from '$lib/toast.svelte';
import Button from '$lib/ui/Button.svelte';

let urlInput = $state('');
let isSubmitting = $state(false);
let activeImportId = $state<string | null>(null);
let submitError = $state<string | null>(null);

const importQuery = createImportStatusQuery(() => activeImportId ?? undefined);
const currentImport = $derived(importQuery.data);

async function handleStartImport(e: SubmitEvent) {
  e.preventDefault();
  const trimmed = urlInput.trim();
  if (!trimmed) return;

  submitError = null;
  isSubmitting = true;

  try {
    const { data, error } = await api.POST('/v1/imports', {
      body: { url: trimmed },
    });

    if (error) {
      const msg =
        typeof error === 'object' && error && 'detail' in error
          ? String((error as { detail: unknown }).detail)
          : 'Failed to initiate import';
      submitError = msg;
      toast.push(msg, { tone: 'danger' });
      return;
    }

    if (data?.id) {
      activeImportId = data.id;
      toast.push('Import queued. Resolving tracks...');
    }
  } catch (err: unknown) {
    console.error('Import error:', err);
    const msg = err instanceof Error ? err.message : 'An error occurred while starting the import';
    submitError = msg;
    toast.push(msg, { tone: 'danger' });
  } finally {
    isSubmitting = false;
  }
}

function handleReset() {
  activeImportId = null;
  urlInput = '';
  submitError = null;
}

const isResolving = $derived(!currentImport?.total || currentImport.total === 0);
const progressPercent = $derived.by(() => {
  if (!currentImport) return 0;
  if (currentImport.status === 'completed') return 100;
  if (!currentImport.total || currentImport.total === 0) return 0;
  const matched = currentImport.matched ?? 0;
  return Math.min(99, Math.round((matched / currentImport.total) * 100));
});
</script>

<svelte:head>
  <title>Import Playlist · NAAD</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
  <!-- Header -->
  <header class="mb-8 border-b border-border pb-6">
    <p class="font-mono text-2xs uppercase tracking-wider text-accent mb-2">Transfer & Ingest</p>
    <h1 class="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
      Import Playlist
    </h1>
    <p class="mt-2 text-sm text-ink-muted max-w-xl">
      Paste a public playlist or album URL from Spotify, Apple Music, or YouTube to import it directly into your NAAD library.
    </p>

    <div class="mt-4 flex flex-wrap gap-2 text-2xs font-mono uppercase tracking-wider">
      <span class="rounded-xs border border-border bg-surface-1 px-2 py-0.5 text-ink-muted">Spotify</span>
      <span class="rounded-xs border border-border bg-surface-1 px-2 py-0.5 text-ink-muted">Apple Music</span>
      <span class="rounded-xs border border-border bg-surface-1 px-2 py-0.5 text-ink-muted">YouTube</span>
    </div>
  </header>

  <!-- Input Form (when not actively importing) -->
  {#if !activeImportId}
    <form onsubmit={handleStartImport} class="space-y-4">
      <div class="rounded-sm border border-border bg-surface-1 p-4 sm:p-6">
        <label for="import-url" class="block font-medium text-xs text-ink mb-2 uppercase tracking-wide">
          Playlist or Album URL
        </label>
        <div class="flex flex-col sm:flex-row gap-3">
          <input
            id="import-url"
            type="url"
            bind:value={urlInput}
            placeholder="https://open.spotify.com/playlist/... or https://music.apple.com/..."
            required
            class="flex-1 rounded-xs border border-border-strong bg-surface-0 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
          />
          <Button
            type="submit"
            variant="solid"
            disabled={isSubmitting || !urlInput.trim()}
            class="shrink-0"
          >
            {isSubmitting ? 'Starting...' : 'Start Import'}
          </Button>
        </div>

        {#if submitError}
          <div class="mt-3 flex items-center gap-2 text-xs text-danger">
            <WarningCircle size={16} class="shrink-0" />
            <span>{submitError}</span>
          </div>
        {/if}
      </div>

      <!-- Informational Card -->
      <div class="rounded-xs border border-border bg-surface-base p-4 text-xs text-ink-muted space-y-1.5">
        <p class="font-medium text-ink">How NAAD imports catalog metadata:</p>
        <p>1. Upstream tracks and ISRC codes are resolved asynchronously from the source service.</p>
        <p>2. Tracks are mapped against NAAD's lossless and high-resolution catalog providers.</p>
        <p>3. A new playlist is added to your library containing all matched tracks.</p>
      </div>
    </form>
  {:else}
    <!-- Active / Completed / Failed Import Status View -->
    <div class="rounded-sm border border-border bg-surface-1 p-6 space-y-6">
      <!-- Status Header -->
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Import #{activeImportId.slice(0, 8)}</span>
          <h2 class="text-lg font-semibold text-ink">
            {#if currentImport?.status === 'completed'}
              Import Completed
            {:else if currentImport?.status === 'failed'}
              Import Failed
            {:else}
              Importing Playlist...
            {/if}
          </h2>
          {#if currentImport?.url}
            <p class="truncate text-xs text-ink-muted max-w-md mt-0.5">{currentImport.url}</p>
          {/if}
        </div>

        <div class="flex items-center gap-2">
          {#if currentImport?.status === 'completed'}
            <span class="inline-flex items-center gap-1.5 rounded-xs border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-xs text-accent">
              <CheckCircle size={14} weight="bold" />
              COMPLETED
            </span>
          {:else if currentImport?.status === 'failed'}
            <span class="inline-flex items-center gap-1.5 rounded-xs border border-danger/40 bg-danger/10 px-2.5 py-1 font-mono text-xs text-danger">
              <WarningCircle size={14} weight="bold" />
              FAILED
            </span>
          {:else}
            <span class="inline-flex items-center gap-1.5 rounded-xs border border-border bg-surface-2 px-2.5 py-1 font-mono text-xs text-ink">
              <span class="size-2 rounded-full bg-accent animate-pulse"></span>
              {currentImport?.status ? currentImport.status.toUpperCase() : 'QUEUED'}
            </span>
          {/if}
        </div>
      </div>

      <!-- Progress Section -->
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs font-mono">
          <span class="text-ink-muted">
            {#if isResolving && currentImport?.status !== 'failed'}
              Fetching playlist details...
            {:else}
              Resolution Progress
            {/if}
          </span>
          <span class="text-ink" data-numeric>{progressPercent}%</span>
        </div>

        <!-- Progress bar hairline -->
        <div class="h-1.5 w-full overflow-hidden rounded-xs bg-surface-3">
          {#if isResolving && currentImport?.status !== 'failed'}
            <div class="h-full w-1/3 bg-accent/60 rounded-xs animate-pulse"></div>
          {:else}
            <div
              class="h-full bg-accent transition-all duration-300"
              style:width="{progressPercent}%"
            ></div>
          {/if}
        </div>

        <div class="flex items-center justify-between text-2xs font-mono text-ink-faint pt-1">
          <span>
            {#if isResolving && currentImport?.status !== 'failed'}
              <span>Connecting to source service...</span>
            {:else}
              Matched: <strong class="text-ink font-semibold">{currentImport?.matched ?? 0}</strong>
              {#if currentImport?.total}
                / {currentImport.total} tracks
              {/if}
            {/if}
          </span>
          {#if currentImport?.unmatched && currentImport.unmatched.length > 0}
            <span class="text-ink-muted">
              Unmatched: {currentImport.unmatched.length}
            </span>
          {/if}
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex flex-wrap items-center gap-3 pt-2">
        {#if currentImport?.playlistId}
          <Button
            variant="solid"
            onclick={() => goto(`/playlist/${currentImport.playlistId}`)}
          >
            <span>View Imported Playlist</span>
            <ArrowRight size={16} />
          </Button>
        {/if}

        {#if currentImport?.status === 'completed' || currentImport?.status === 'failed'}
          <Button variant="outline" onclick={handleReset}>
            Import Another Playlist
          </Button>
        {/if}
      </div>

      <!-- Error view if failed -->
      {#if currentImport?.status === 'failed' && currentImport?.error}
        <div class="rounded-xs border border-danger/30 bg-danger/5 p-4 text-xs text-danger">
          <p class="font-medium">Import process encountered an error:</p>
          <p class="mt-1">{currentImport.error}</p>
        </div>
      {/if}

      <!-- Unmatched Tracks Report -->
      {#if currentImport?.unmatched && currentImport.unmatched.length > 0}
        <div class="border-t border-border pt-6 space-y-3">
          <div class="flex items-baseline justify-between">
            <h3 class="font-medium text-sm text-ink">Unmatched Tracks ({currentImport.unmatched.length})</h3>
            <span class="text-2xs text-ink-faint font-mono">Not found in configured sources</span>
          </div>

          <div class="overflow-x-auto rounded-xs border border-border">
            <table class="w-full text-left text-xs">
              <thead class="border-b border-border bg-surface-0 font-mono text-2xs uppercase text-ink-faint">
                <tr>
                  <th class="px-3 py-2 text-right w-12" data-numeric>#</th>
                  <th class="px-3 py-2">Title</th>
                  <th class="px-3 py-2">Artist</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                {#each currentImport.unmatched as track}
                  <tr class="hover:bg-surface-2/40">
                    <td class="px-3 py-2 text-right font-mono text-ink-faint" data-numeric>{track.position}</td>
                    <td class="px-3 py-2 font-medium text-ink">{track.title}</td>
                    <td class="px-3 py-2 text-ink-muted">{track.artists.join(', ')}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
