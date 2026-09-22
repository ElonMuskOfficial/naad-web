<script lang="ts">
import { toast } from '$lib/toast.svelte';
</script>

<!-- One instance lives in the root layout. Bottom-center, above the player bar. -->
<div class="pointer-events-none fixed inset-x-0 bottom-[calc(72px+var(--spacing)*4)] z-[60] flex flex-col items-center gap-2 px-4">
  {#each toast.items as t (t.id)}
    <div
      class="pointer-events-auto flex items-center gap-3 rounded-sm border border-border-strong bg-surface-2 px-3.5 py-2.5 shadow-float
        animate-in fade-in-0 slide-in-from-bottom-1"
      role="status"
    >
      <span class="size-[5px] shrink-0 rounded-full {t.tone === 'danger' ? 'bg-danger' : 'bg-accent'}" aria-hidden="true"></span>
      <p class="text-xs text-ink">{t.message}</p>
      {#if t.action}
        <button
          type="button"
          class="text-xs font-medium text-accent hover:underline"
          onclick={() => {
            t.action?.onClick();
            toast.dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      {/if}
    </div>
  {/each}
</div>
