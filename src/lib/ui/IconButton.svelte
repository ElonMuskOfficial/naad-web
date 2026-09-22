<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';

interface Props extends HTMLButtonAttributes {
  /** "transport" = the large circular player-bar controls; "tool" = small square/list actions. */
  variant?: 'transport' | 'tool';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  label: string; // required: every icon button must be labelled for screen readers
  children: Snippet;
}

let {
  variant = 'tool',
  size = 'md',
  active = false,
  label,
  class: className = '',
  children,
  ...rest
}: Props = $props();

const sizes = { sm: 'size-6', md: 'size-8', lg: 'size-11' };
const shape = $derived(variant === 'transport' ? 'rounded-full' : 'rounded-xs');
const tone = $derived(
  variant === 'transport'
    ? 'text-ink hover:bg-surface-2'
    : active
      ? 'text-accent'
      : 'text-ink-muted hover:text-ink hover:bg-surface-2',
);
</script>

<button
  class="inline-flex items-center justify-center {sizes[size]} {shape} {tone} transition-colors duration-[var(--duration-fast)] disabled:opacity-40 disabled:pointer-events-none active:scale-95 {className}"
  aria-label={label}
  aria-pressed={variant === 'tool' ? active : undefined}
  title={label}
  {...rest}
>
  {@render children()}
</button>
