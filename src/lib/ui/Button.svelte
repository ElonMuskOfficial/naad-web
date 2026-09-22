<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';

interface Props extends HTMLButtonAttributes {
  variant?: 'solid' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  children: Snippet;
}

let { variant = 'outline', size = 'md', class: className = '', children, ...rest }: Props = $props();

const base =
  'inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-signal)] disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]';

const sizes = {
  sm: 'h-7 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
};

const variants = {
  solid: 'bg-accent text-accent-ink hover:brightness-105',
  outline: 'border border-border-strong text-ink hover:bg-surface-2',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger text-danger-ink hover:brightness-105',
};
</script>

<button class="{base} {sizes[size]} {variants[variant]} {className}" {...rest}>
  {@render children()}
</button>
