<script lang="ts">
import { DropdownMenu } from 'bits-ui';
import type { Snippet } from 'svelte';

interface Props {
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: Snippet;
  children: Snippet;
}

let { onSelect, danger = false, disabled = false, icon, children }: Props = $props();
</script>

<DropdownMenu.Item
  {disabled}
  onSelect={() => onSelect?.()}
  class="flex h-8 items-center gap-2.5 rounded-xs px-2.5 text-sm outline-none
    data-[highlighted]:bg-surface-3
    {danger ? 'text-danger' : 'text-ink'}
    {disabled ? 'opacity-40' : ''}"
>
  {#if icon}<span class="flex size-4 items-center justify-center text-ink-muted">{@render icon()}</span>{/if}
  {@render children()}
</DropdownMenu.Item>
