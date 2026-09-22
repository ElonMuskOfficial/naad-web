<script lang="ts">
interface Props {
  width?: string;
  height?: string;
  radius?: 'xs' | 'sm' | 'full';
  class?: string;
}
let { width = '100%', height = '1em', radius = 'xs', class: className = '' }: Props = $props();
const r = $derived({ xs: 'rounded-xs', sm: 'rounded-sm', full: 'rounded-full' }[radius]);
</script>

<!-- A slow, quiet pulse — never a moving shimmer gradient — and it matches the real layout's
     exact dimensions rather than a generic grey rectangle. -->
<span class="inline-block animate-pulse-slow bg-surface-2 {r} {className}" style:width style:height aria-hidden="true"></span>

<style>
  :global(.animate-pulse-slow) {
    animation: pulse-slow 1.8s ease-in-out infinite;
  }
  @keyframes pulse-slow {
    0%,
    100% {
      opacity: 0.55;
    }
    50% {
      opacity: 0.9;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.animate-pulse-slow) {
      animation: none;
      opacity: 0.7;
    }
  }
</style>
