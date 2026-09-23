<script lang="ts">
import { page } from '$app/state';
import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
import Button from '$lib/ui/Button.svelte';

const status = $derived(page.status ?? 404);
const message = $derived(page.error?.message || (status === 404 ? 'Page not found' : 'An error occurred'));
</script>

<svelte:head>
  <title>{status} · NAAD</title>
</svelte:head>

<div class="flex h-full min-h-[60vh] flex-col items-center justify-center p-6 text-center">
  <div class="rounded-xs border border-border bg-surface-1 p-8 max-w-md w-full text-center space-y-4">
    <div class="flex justify-center text-accent">
      <WarningCircle size={32} weight="light" />
    </div>

    <div class="space-y-1">
      <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint">Status {status}</span>
      <h1 class="font-display text-2xl font-semibold text-ink">{message}</h1>
      <p class="text-xs text-ink-muted">
        The requested resource could not be loaded or reached on the engine.
      </p>
    </div>

    <div class="flex justify-center gap-3 pt-2">
      <Button variant="solid" size="sm" onclick={() => (window.location.href = '/')}>
        Go to Home
      </Button>
      <Button variant="outline" size="sm" onclick={() => window.history.back()}>
        Back
      </Button>
    </div>
  </div>
</div>
