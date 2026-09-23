<script lang="ts">
import { Dialog } from 'bits-ui';
import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
import { type CommandAction, COMMAND_ACTIONS, type CommandContext } from '$lib/keys';

interface Props {
  open: boolean;
  context: CommandContext;
}

let { open = $bindable(), context }: Props = $props();

let searchQuery = $state('');
let selectedIndex = $state(0);
let inputEl = $state<HTMLInputElement | null>(null);

const filteredActions = $derived.by(() => {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return COMMAND_ACTIONS;
  return COMMAND_ACTIONS.filter(
    (action) =>
      action.title.toLowerCase().includes(q) ||
      action.category.toLowerCase().includes(q) ||
      action.keywords?.some((k) => k.toLowerCase().includes(q)),
  );
});

// Reset selectedIndex whenever search query or filtered list changes
$effect(() => {
  if (filteredActions.length > 0 && selectedIndex >= filteredActions.length) {
    selectedIndex = 0;
  }
});

$effect(() => {
  if (open) {
    searchQuery = '';
    selectedIndex = 0;
    setTimeout(() => {
      inputEl?.focus();
    }, 50);
  }
});

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (filteredActions.length > 0) {
      selectedIndex = (selectedIndex + 1) % filteredActions.length;
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (filteredActions.length > 0) {
      selectedIndex = (selectedIndex - 1 + filteredActions.length) % filteredActions.length;
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const action = filteredActions[selectedIndex];
    if (action) {
      executeAction(action);
    }
  }
}

function executeAction(action: CommandAction) {
  open = false;
  action.perform(context);
}
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="naad-anim-fade fixed inset-0 z-50 bg-black/60 backdrop-blur-[1px]" />
    <Dialog.Content
      class="naad-anim-scale fixed left-1/2 top-[18%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-sm border border-border-strong bg-surface-1 shadow-float outline-none max-sm:top-4 max-sm:w-[94%]"
      onkeydown={handleKeydown}
    >
      <!-- Hidden Title for accessibility -->
      <Dialog.Title class="sr-only">Command Palette</Dialog.Title>
      <Dialog.Description class="sr-only">Search and run quick actions across NAAD</Dialog.Description>

      <!-- Search Input Header -->
      <div class="relative flex items-center border-b border-border px-4 py-3">
        <MagnifyingGlass size={18} class="mr-3 shrink-0 text-ink-muted" />
        <input
          bind:this={inputEl}
          bind:value={searchQuery}
          type="text"
          placeholder="Type a command, route, or shortcut..."
          class="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <kbd
          class="ml-2 inline-flex items-center rounded-xs border border-border px-1.5 py-0.5 font-mono text-[10px] text-ink-faint"
        >
          ESC
        </kbd>
      </div>

      <!-- Actions List -->
      <div class="max-h-80 overflow-y-auto p-2" role="listbox">
        {#if filteredActions.length === 0}
          <div class="py-8 text-center text-xs text-ink-muted">
            No matching commands for "{searchQuery}"
          </div>
        {:else}
          {#each filteredActions as action, idx (action.id)}
            {@const isSelected = idx === selectedIndex}
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              class="flex w-full items-center justify-between rounded-xs px-3 py-2 text-left text-xs transition-colors {isSelected
                ? 'bg-surface-2 text-ink'
                : 'text-ink-muted hover:bg-surface-2/60 hover:text-ink'}"
              onclick={() => executeAction(action)}
              onmouseenter={() => (selectedIndex = idx)}
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <span
                  class="font-mono text-[10px] uppercase tracking-wider {isSelected
                    ? 'text-accent'
                    : 'text-ink-faint'}"
                >
                  [{action.category}]
                </span>
                <span class="truncate font-medium {isSelected ? 'text-ink' : ''}">
                  {action.title}
                </span>
              </div>

              {#if action.shortcut}
                <div class="flex items-center gap-1 shrink-0">
                  {#each action.shortcut as key}
                    <kbd
                      class="rounded-xs border border-border bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
                    >
                      {key}
                    </kbd>
                  {/each}
                </div>
              {:else if isSelected}
                <ArrowRight size={14} class="text-ink-faint shrink-0" />
              {/if}
            </button>
          {/each}
        {/if}
      </div>

      <!-- Footer Help Hints -->
      <div class="flex items-center justify-between border-t border-border bg-surface-base px-3.5 py-2 text-[11px] text-ink-faint font-mono">
        <span>NAAD COMMAND PALETTE</span>
        <div class="flex items-center gap-3">
          <span><kbd class="text-ink-muted">↑↓</kbd> navigate</span>
          <span><kbd class="text-ink-muted">↵</kbd> run</span>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
