<script lang="ts">
import { Dialog } from 'bits-ui';
import X from 'phosphor-svelte/lib/X';
import type { Snippet } from 'svelte';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  children: Snippet;
}

let { open = $bindable(), title, description, children }: Props = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 z-40 bg-black/50
        data-[state=open]:animate-in data-[state=open]:fade-in-0
        data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
    />
    <Dialog.Content
      class="fixed z-50 border border-border-strong bg-surface-1 shadow-float outline-none
        max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-md max-sm:border-b-0 max-sm:pb-[env(safe-area-inset-bottom)]
        max-sm:data-[state=open]:animate-in max-sm:data-[state=open]:slide-in-from-bottom
        max-sm:data-[state=closed]:animate-out max-sm:data-[state=closed]:slide-out-to-bottom
        sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md
        sm:data-[state=open]:animate-in sm:data-[state=open]:fade-in-0 sm:data-[state=open]:zoom-in-95
        sm:data-[state=closed]:animate-out sm:data-[state=closed]:fade-out-0"
    >
      <div class="flex items-start justify-between gap-4 p-4 pb-3">
        <div class="min-w-0">
          <Dialog.Title class="text-md font-medium text-ink">{title}</Dialog.Title>
          {#if description}<Dialog.Description class="text-xs text-ink-muted">{description}</Dialog.Description>{/if}
        </div>
        <Dialog.Close class="shrink-0 text-ink-muted hover:text-ink" aria-label="Close">
          <X size={18} />
        </Dialog.Close>
      </div>
      <div class="max-h-[70vh] overflow-y-auto px-4 pb-4">
        {@render children()}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
