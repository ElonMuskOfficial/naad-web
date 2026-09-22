<script lang="ts">
import { formatTime } from '$lib/format';

interface Props {
  /** Seconds. `value` is bindable so the parent (the player) can drive it during playback. */
  value: number;
  duration: number;
  buffered?: number;
  disabled?: boolean;
  onseek?: (seconds: number) => void;
  onscrubstart?: () => void;
  onscrubend?: (seconds: number) => void;
  showTime?: boolean;
  size?: 'sm' | 'lg';
}

let {
  value = $bindable(),
  duration,
  buffered = 0,
  disabled = false,
  onseek,
  onscrubstart,
  onscrubend,
  showTime = true,
  size = 'sm',
}: Props = $props();

let dragging = $state(false);
let localValue = $state(value);
$effect(() => {
  if (!dragging) localValue = value;
});

const pct = (n: number) => (duration > 0 ? Math.min(100, Math.max(0, (n / duration) * 100)) : 0);

function onInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value);
  localValue = v;
  onseek?.(v);
}
function onPointerDown() {
  dragging = true;
  onscrubstart?.();
}
function onPointerUp() {
  dragging = false;
  onscrubend?.(localValue);
}
</script>

<div class="flex items-center gap-2" class:flex-col={false}>
  {#if showTime}
    <span class="font-mono text-2xs text-ink-muted w-9 text-right" data-numeric>{formatTime(localValue)}</span>
  {/if}
  <div class="relative flex-1 group" class:h-1={size === 'sm'} class:h-1.5={size === 'lg'}>
    <div class="absolute inset-0 rounded-full bg-surface-3" aria-hidden="true"></div>
    <div class="absolute inset-y-0 left-0 rounded-full bg-ink-faint" style:width="{pct(buffered)}%" aria-hidden="true"></div>
    <div
      class="absolute inset-y-0 left-0 rounded-full bg-ink-muted transition-colors group-hover:bg-ink"
      class:bg-ink={dragging}
      style:width="{pct(localValue)}%"
      aria-hidden="true"
    ></div>
    <div
      class="pointer-events-none absolute top-1/2 size-2.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-accent opacity-0 transition-opacity group-hover:opacity-100"
      class:opacity-100={dragging}
      style:left="{pct(localValue)}%"
      aria-hidden="true"
    ></div>
    <input
      type="range"
      class="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:h-full"
      min="0"
      max={Math.max(duration, 0.01)}
      step="0.1"
      value={localValue}
      {disabled}
      oninput={onInput}
      onpointerdown={onPointerDown}
      onpointerup={onPointerUp}
      aria-label="Seek"
      aria-valuetext="{formatTime(localValue)} of {formatTime(duration)}"
    />
  </div>
  {#if showTime}
    <span class="font-mono text-2xs text-ink-muted w-9" data-numeric>{formatTime(duration)}</span>
  {/if}
</div>
