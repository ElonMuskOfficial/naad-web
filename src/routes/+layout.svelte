<script lang="ts">
import '../app.css';
import favicon from '$lib/assets/favicon.svg';
import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
import { page } from '$app/state';
import { tick } from 'svelte';
import { type CommandContext, handleGlobalKeydown } from '$lib/keys';
import { player } from '$lib/player/engine.svelte';
import { queryClient, toggleLikeCurrent } from '$lib/queries';
import CommandPalette from '$lib/ui/CommandPalette.svelte';
import MobileMiniPlayer from '$lib/ui/MobileMiniPlayer.svelte';
import MobileNav from '$lib/ui/MobileNav.svelte';
import PlayerBar from '$lib/ui/PlayerBar.svelte';
import RightPanel from '$lib/ui/RightPanel.svelte';
import Sidebar from '$lib/ui/Sidebar.svelte';
import ToastViewport from '$lib/ui/ToastViewport.svelte';
import TrackContextMenu from '$lib/ui/TrackContextMenu.svelte';
import { QueryClientProvider } from '@tanstack/svelte-query';

let { children } = $props();
const isNowPlaying = $derived(page.url.pathname.startsWith('/now-playing'));

let mainEl = $state<HTMLElement>();
const scrollPositions = new Map<string, number>();

beforeNavigate(({ from }) => {
  if (from?.url && mainEl) {
    const key = from.url.pathname + from.url.search;
    scrollPositions.set(key, mainEl.scrollTop);
  }
});

afterNavigate(({ to, type }) => {
  if (type === 'popstate' && to?.url && mainEl) {
    const key = to.url.pathname + to.url.search;
    const savedScroll = scrollPositions.get(key);
    if (savedScroll !== undefined) {
      tick().then(() => {
        if (mainEl) {
          mainEl.scrollTop = savedScroll;
          requestAnimationFrame(() => {
            if (mainEl) mainEl.scrollTop = savedScroll;
          });
        }
      });
    }
  } else if (type !== 'popstate' && mainEl) {
    mainEl.scrollTop = 0;
  }
});

let paletteOpen = $state(false);

const commandContext: CommandContext = {
  player,
  goto: (url: string) => goto(url),
  togglePalette: () => {
    paletteOpen = !paletteOpen;
  },
  likeCurrentTrack: async () => {
    if (!player.currentTrack) return;
    try {
      await toggleLikeCurrent(player.currentTrack);
    } catch {
      // toggleLikeCurrent / toggleLikeTrack already told the user
    }
  },
};

function onWindowKeydown(e: KeyboardEvent) {
  handleGlobalKeydown(e, commandContext);
}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<svelte:head>
  <title>NAAD</title>
  <link rel="icon" href={favicon} />
</svelte:head>

<QueryClientProvider client={queryClient}>
  <div class="flex h-screen w-screen overflow-hidden bg-surface-0 text-ink">
    <!-- Desktop Sidebar (hidden on now-playing or below sm) -->
    {#if !isNowPlaying}
      <Sidebar />
    {/if}

    <!-- Center Column: Scrollable Content + Player Bar / Mobile Nav -->
    <div class="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
      <!-- Main Content Area -->
      <main bind:this={mainEl} class="flex-1 min-w-0 overflow-y-auto bg-surface-0">
        {@render children()}
      </main>

      {#if !isNowPlaying}
        <!-- Desktop Player Bar (72px, fixed at bottom) -->
        <PlayerBar />

        <!-- Mobile Mini-Player (docked above bottom nav) -->
        <MobileMiniPlayer />

        <!-- Mobile Bottom Navigation (56px) -->
        <MobileNav />
      {/if}
    </div>

    {#if !isNowPlaying}
      <!-- Desktop Collapsible Right Panel (hidden below lg) -->
      <RightPanel />
    {/if}
  </div>

  <CommandPalette bind:open={paletteOpen} context={commandContext} />
  <TrackContextMenu {player} />
  <ToastViewport />
</QueryClientProvider>
