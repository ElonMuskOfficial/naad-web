<script lang="ts">
import { goto } from '$app/navigation';
import { useQueryClient } from '@tanstack/svelte-query';
import Broadcast from 'phosphor-svelte/lib/Broadcast';
import Disc from 'phosphor-svelte/lib/Disc';
import Heart from 'phosphor-svelte/lib/Heart';
import ListPlus from 'phosphor-svelte/lib/ListPlus';
import Playlist from 'phosphor-svelte/lib/Playlist';
import Plus from 'phosphor-svelte/lib/Plus';
import User from 'phosphor-svelte/lib/User';
import { api } from '$lib/api/client';
import { trackMenu } from '$lib/context-menu.svelte';
import { type PlayerEngine } from '$lib/player/engine.svelte';
import { createLibraryPlaylistsQuery } from '$lib/queries';
import { toast } from '$lib/toast.svelte';
import Button from './Button.svelte';
import Menu from './Menu.svelte';
import MenuItem from './MenuItem.svelte';
import Sheet from './Sheet.svelte';

interface Props {
  player: PlayerEngine;
}

let { player }: Props = $props();

const queryClient = useQueryClient();
const playlistsQuery = createLibraryPlaylistsQuery();

// Liked tracks set check
async function handleToggleLike() {
  if (!trackMenu.track) return;
  const track = trackMenu.track;
  trackMenu.close();

  try {
    // Check if liked or optimistic toggle
    const { error } = await api.PUT('/v1/library/tracks', {
      body: { trackIds: [track.id] },
    });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['library', 'tracks'] });
    toast.push(`Added "${track.title}" to Liked Songs`);
  } catch (err) {
    console.warn('[TrackContextMenu] like error:', err);
    toast.push('Could not update Liked Songs', { tone: 'danger' });
  }
}

function handlePlayNext() {
  if (!trackMenu.track) return;
  player.playNext(trackMenu.track);
  trackMenu.close();
}

function handleAddToQueue() {
  if (!trackMenu.track) return;
  player.addToQueue(trackMenu.track);
  trackMenu.close();
}

function handleStartRadio() {
  if (!trackMenu.track) return;
  const track = trackMenu.track;
  trackMenu.close();
  player.startRadio('track', track.id, track);
}

function handleGoToAlbum() {
  if (!trackMenu.track?.album) return;
  const albumId = trackMenu.track.album.id;
  trackMenu.close();
  goto(`/album/${albumId}`);
}

function handleGoToArtist() {
  if (!trackMenu.track?.artists[0]) return;
  const artistId = trackMenu.track.artists[0].id;
  trackMenu.close();
  goto(`/artist/${artistId}`);
}

async function handleAddTrackToPlaylist(playlistId: string, playlistTitle: string) {
  if (!trackMenu.targetTrackForPlaylist) return;
  const track = trackMenu.targetTrackForPlaylist;
  try {
    const { error } = await api.POST('/v1/playlists/{id}/items', {
      params: { path: { id: playlistId } },
      body: { trackIds: [track.id] },
    });
    if (error) throw error;
    toast.push(`Added "${track.title}" to "${playlistTitle}"`);
    queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
  } catch (err) {
    console.warn('[TrackContextMenu] add to playlist error:', err);
    toast.push(`Could not add to playlist`, { tone: 'danger' });
  } finally {
    trackMenu.closePlaylistModal();
  }
}
</script>

<!-- Track Context Menu -->
<Menu bind:open={trackMenu.open} anchor={trackMenu.anchor}>
  {#if trackMenu.track}
    <div class="px-2.5 py-1.5 border-b border-border mb-1">
      <p class="truncate font-medium text-xs text-ink">{trackMenu.track.title}</p>
      <p class="truncate text-[10px] text-ink-muted">
        {trackMenu.track.artists.map((a) => a.name).join(', ')}
      </p>
    </div>

    <MenuItem onSelect={handlePlayNext}>
      {#snippet icon()}<ListPlus size={16} />{/snippet}
      Play next
    </MenuItem>

    <MenuItem onSelect={handleAddToQueue}>
      {#snippet icon()}<ListPlus size={16} />{/snippet}
      Add to queue
    </MenuItem>

    <MenuItem onSelect={handleStartRadio}>
      {#snippet icon()}<Broadcast size={16} />{/snippet}
      Start radio
    </MenuItem>

    <MenuItem onSelect={handleToggleLike}>
      {#snippet icon()}<Heart size={16} />{/snippet}
      Save to Liked Songs
    </MenuItem>

    <MenuItem onSelect={() => trackMenu.track && trackMenu.openAddToPlaylist(trackMenu.track)}>
      {#snippet icon()}<Playlist size={16} />{/snippet}
      Add to playlist...
    </MenuItem>

    {#if trackMenu.track.album}
      <MenuItem onSelect={handleGoToAlbum}>
        {#snippet icon()}<Disc size={16} />{/snippet}
        Go to album
      </MenuItem>
    {/if}

    {#if trackMenu.track.artists[0]}
      <MenuItem onSelect={handleGoToArtist}>
        {#snippet icon()}<User size={16} />{/snippet}
        Go to artist
      </MenuItem>
    {/if}
  {/if}
</Menu>

<!-- Add To Playlist Sheet/Dialog -->
<Sheet
  bind:open={trackMenu.playlistModalOpen}
  title="Add to Playlist"
  description={trackMenu.targetTrackForPlaylist ? `Choose a playlist for "${trackMenu.targetTrackForPlaylist.title}"` : undefined}
>
  <div class="space-y-1.5 pt-2">
    {#if playlistsQuery.isPending}
      <div class="py-6 text-center text-xs text-ink-muted">Loading playlists...</div>
    {:else if playlistsQuery.data && playlistsQuery.data.length > 0}
      {#each playlistsQuery.data as pl (pl.id)}
        <button
          type="button"
          class="flex w-full items-center justify-between rounded-xs px-3 py-2 text-left text-sm hover:bg-surface-2 transition-colors group"
          onclick={() => handleAddTrackToPlaylist(pl.id, pl.title)}
        >
          <div class="min-w-0">
            <p class="truncate font-medium text-ink group-hover:text-accent">{pl.title}</p>
            <p class="text-xs text-ink-muted">{pl.trackCount} {pl.trackCount === 1 ? 'track' : 'tracks'}</p>
          </div>
          <Plus size={16} class="text-ink-faint group-hover:text-ink shrink-0 ml-2" />
        </button>
      {/each}
    {:else}
      <div class="py-6 text-center text-xs text-ink-muted">
        No playlists found in your library.
      </div>
    {/if}

    <div class="pt-3 border-t border-border flex justify-end">
      <Button variant="ghost" size="sm" onclick={() => trackMenu.closePlaylistModal()}>
        Cancel
      </Button>
    </div>
  </div>
</Sheet>
