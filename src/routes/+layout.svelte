<script lang="ts">
import '../app.css';
import favicon from '$lib/assets/favicon.svg';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { api } from '$lib/api/client';
import { type CommandContext, handleGlobalKeydown } from '$lib/keys';
import { player } from '$lib/player/engine.svelte';
import { queryClient } from '$lib/queries';
import { toast } from '$lib/toast.svelte';
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
      await api.PUT('/v1/library/tracks', {
        body: { trackIds: [player.currentTrack.id] },
      });
      queryClient.invalidateQueries({ queryKey: ['library', 'tracks'] });
      toast.push(`Added "${player.currentTrack.title}" to Liked Songs`);
    } catch {
      toast.push('Could not update Liked Songs', { tone: 'danger' });
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
      <main class="flex-1 min-w-0 overflow-y-auto bg-surface-0">
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
