<script lang="ts">
import { DropdownMenu } from 'bits-ui';
import type { Snippet } from 'svelte';

interface Props {
  open: boolean;
  anchor: HTMLElement | null;
  children: Snippet;
}

let { open = $bindable(), anchor, children }: Props = $props();
</script>

<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger class="sr-only" tabindex={-1} aria-hidden="true"></DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      customAnchor={anchor}
      sideOffset={6}
      class="z-50 min-w-[200px] rounded-sm border border-border-strong bg-surface-2 p-1 shadow-float outline-none
        data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
        data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
    >
      {@render children()}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
