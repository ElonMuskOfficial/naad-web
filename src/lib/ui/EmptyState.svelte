<script lang="ts">
import type { Snippet } from 'svelte';
import Button from './Button.svelte';

interface Props {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: Snippet;
}

let { title, description, action, icon }: Props = $props();
</script>

<div class="flex flex-col items-center gap-3 py-16 text-center">
  {#if icon}
    <div class="text-ink-faint">{@render icon()}</div>
  {/if}
  <div class="space-y-1">
    <p class="text-md font-medium text-ink">{title}</p>
    {#if description}<p class="max-w-xs text-sm text-ink-muted">{description}</p>{/if}
  </div>
  {#if action}
    <Button variant="outline" size="sm" onclick={action.onClick}>{action.label}</Button>
  {/if}
</div>
