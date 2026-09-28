<script lang="ts">
import { page } from '$app/state';
import { goto } from '$app/navigation';
import { api } from '$lib/api/client';
import { formatDurationMs } from '$lib/format';
import { Play, Shuffle } from '$lib/icons';
import { player } from '$lib/player/engine.svelte';
import { createLikedContainsQuery, createPlaylistQuery, queryClient } from '$lib/queries';
import { toast } from '$lib/toast.svelte';
import type { Track } from '$lib/types';
import ArtistLinks from '$lib/ui/ArtistLinks.svelte';
import Artwork from '$lib/ui/Artwork.svelte';
import Button from '$lib/ui/Button.svelte';
import EmptyState from '$lib/ui/EmptyState.svelte';
import IconButton from '$lib/ui/IconButton.svelte';
import Skeleton from '$lib/ui/Skeleton.svelte';
import ArrowDown from 'phosphor-svelte/lib/ArrowDown';
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
import ArrowUp from 'phosphor-svelte/lib/ArrowUp';
import Check from 'phosphor-svelte/lib/Check';
import DotsSixVertical from 'phosphor-svelte/lib/DotsSixVertical';
import Heart from 'phosphor-svelte/lib/Heart';
import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
import Trash from 'phosphor-svelte/lib/Trash';

const playlistId = $derived(page.params.id ?? '');
const playlistQuery = createPlaylistQuery(() => playlistId);

interface PlaylistItem {
  itemId: string;
  addedAt: string;
  track: Track;
}

let items = $state<PlaylistItem[]>([]);
let draggedIndex = $state<number | null>(null);
let dragOverIndex = $state<number | null>(null);

// Sync local items with query data: naad returns parallel `tracks`/`entries` arrays for the user's
// own playlist (same order, same length), and only `tracks` for an external (JioSaavn) one.
$effect(() => {
  const tracks = playlistQuery.data?.tracks;
  const entries = playlistQuery.data?.entries;
  if (tracks) {
    items = tracks.map((track, i) => ({
      itemId: entries?.[i]?.itemId ?? `${playlistId}:${i}`,
      addedAt: entries?.[i]?.addedAt ?? new Date(0).toISOString(),
      track,
    }));
  }
});

const isEditablePlaylist = $derived(playlistQuery.data?.origin === 'user');

// Inline editing state
let isEditing = $state(false);
let editTitle = $state('');
let editDescription = $state('');

$effect(() => {
  if (playlistQuery.data && !isEditing) {
    editTitle = playlistQuery.data.title;
    editDescription = playlistQuery.data.description ?? '';
  }
});

// Liked tracks query
const trackIds = $derived(items.map((it) => it.track.id));
const likedQuery = createLikedContainsQuery(() => trackIds);
const likedIds = $derived(likedQuery.data ?? new Set<string>());

const totalDurationMs = $derived(items.reduce((acc, it) => acc + (it.track.durationMs ?? 0), 0));

// Cover artwork: playlist images or first available track/album image
const coverArtwork = $derived(
  playlistQuery.data?.images?.[0]?.url ??
    items.find((it) => it.track?.images?.[0]?.url || it.track?.album?.images?.[0]?.url)?.track?.images?.[0]
      ?.url ??
    items.find((it) => it.track?.album?.images?.[0]?.url)?.track?.album?.images?.[0]?.url,
);

function playAll() {
  if (items.length > 0) {
    const tracks = items.map((it) => it.track);
    player.playTrack(tracks[0]!, tracks, { type: 'playlist', id: playlistId });
  }
}

function shuffleAll() {
  if (items.length > 0) {
    const tracks = items.map((it) => it.track);
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    player.shuffle = true;
    player.playTrack(shuffled[0]!, shuffled, { type: 'playlist', id: playlistId });
  }
}

async function saveMetadata() {
  if (!editTitle.trim()) return;
  try {
    await api.PATCH('/v1/playlists/{id}', {
      params: { path: { id: playlistId } },
      // an empty description is sent as '' so that it clears the old one (undefined would leave it alone)
      body: { title: editTitle.trim(), description: editDescription.trim() },
    });
    isEditing = false;
    queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
    queryClient.invalidateQueries({ queryKey: ['library', 'playlists'] });
    toast.push('Playlist updated');
  } catch (err) {
    toast.push('Failed to update playlist', { tone: 'danger' });
  }
}

async function deletePlaylist() {
  if (!confirm(`Are you sure you want to delete "${playlistQuery.data?.title}"?`)) return;
  try {
    await api.DELETE('/v1/playlists/{id}', {
      params: { path: { id: playlistId } },
    });
    queryClient.invalidateQueries({ queryKey: ['library', 'playlists'] });
    toast.push('Playlist deleted');
    goto('/library');
  } catch (err) {
    toast.push('Failed to delete playlist', { tone: 'danger' });
  }
}

async function removeItem(itemId: string, title: string) {
  const prevItems = [...items];
  items = items.filter((it) => it.itemId !== itemId);
  try {
    await api.DELETE('/v1/playlists/{id}/items', {
      params: { path: { id: playlistId } },
      body: { itemIds: [itemId] },
    });
    queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
    toast.push(`Removed "${title}" from playlist`);
  } catch (err) {
    items = prevItems;
    toast.push('Failed to remove track', { tone: 'danger' });
  }
}

// Drag & Drop reorder
function handleDragStart(index: number, e: DragEvent) {
  draggedIndex = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }
}

function handleDragOver(index: number, e: DragEvent) {
  e.preventDefault();
  dragOverIndex = index;
}

async function handleDrop(targetIndex: number, e: DragEvent) {
  e.preventDefault();
  if (draggedIndex === null || draggedIndex === targetIndex) {
    draggedIndex = null;
    dragOverIndex = null;
    return;
  }
  await executeMove(draggedIndex, targetIndex);
  draggedIndex = null;
  dragOverIndex = null;
}

// Accessible keyboard Move Up / Move Down
async function moveUp(index: number) {
  if (index <= 0) return;
  await executeMove(index, index - 1);
}

async function moveDown(index: number) {
  if (index >= items.length - 1) return;
  await executeMove(index, index + 1);
}

async function executeMove(fromIndex: number, toIndex: number) {
  const prev = [...items];
  const newItems = [...items];
  const [moved] = newItems.splice(fromIndex, 1);
  if (!moved) return;
  newItems.splice(toIndex, 0, moved);
  items = newItems;

  let afterItemId: string | null = null;
  if (toIndex === 0) {
    afterItemId = null;
  } else {
    afterItemId = newItems[toIndex - 1]!.itemId;
  }

  try {
    await api.POST('/v1/playlists/{id}/items/{itemId}/move', {
      params: { path: { id: playlistId, itemId: moved.itemId } },
      body: { afterItemId },
    });
    queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
  } catch (err) {
    items = prev;
    toast.push('Failed to move track', { tone: 'danger' });
  }
}
</script>

<svelte:head>
  <title>{playlistQuery.data?.title ? `${playlistQuery.data.title} — NAAD` : 'Playlist — NAAD'}</title>
</svelte:head>

<div class="px-4 py-6 sm:px-6 sm:py-8 max-w-7xl mx-auto flex flex-col gap-8">
  <!-- Back navigation -->
  <div class="flex items-center gap-2">
    <button
      type="button"
      onclick={() => window.history.back()}
      class="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
      aria-label="Back"
    >
      <ArrowLeft size={16} weight="light" />
      <span>Back</span>
    </button>
  </div>

  {#if playlistQuery.isPending}
    <div class="flex flex-col gap-8" aria-label="Loading playlist">
      <div class="flex flex-col sm:flex-row items-center sm:items-end gap-6 pb-6 border-b border-border">
        <Skeleton class="size-44 sm:size-48 rounded-sm shrink-0" />
        <div class="flex flex-col gap-3 min-w-0 flex-1">
          <Skeleton class="h-3 w-16" />
          <Skeleton class="h-10 w-64 max-w-md" />
          <Skeleton class="h-4 w-40" />
          <div class="flex items-center gap-3 mt-2">
            <Skeleton class="h-9 w-24 rounded-full" />
            <Skeleton class="h-9 w-28 rounded-xs" />
          </div>
        </div>
      </div>
    </div>
  {:else if playlistQuery.isError || !playlistQuery.data}
    <div class="py-16 flex flex-col items-center justify-center text-center">
      <p class="text-sm text-ink-muted mb-4">Could not load playlist.</p>
      <Button variant="outline" onclick={() => playlistQuery.refetch()}>Try again</Button>
    </div>
  {:else}
    {@const pl = playlistQuery.data}

    <!-- Playlist Header -->
    <header class="flex flex-col sm:flex-row items-center sm:items-end gap-6 pb-6 border-b border-border">
      <div class="relative size-40 sm:size-48 shrink-0 rounded-xs overflow-hidden bg-surface-2 border border-border shadow-xs">
        <Artwork
          src={coverArtwork}
          alt={pl.title}
          size={200}
          class="size-full object-cover"
        />
      </div>

      <div class="flex flex-col items-center sm:items-start min-w-0 flex-1 text-center sm:text-left">
        <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint">
          Playlist · {pl.origin === 'user' ? 'Library' : 'JioSaavn'}
        </span>

        {#if isEditing}
          <div class="flex flex-col gap-2 w-full max-w-md mt-2">
            <input
              type="text"
              bind:value={editTitle}
              class="h-10 px-3 rounded-xs bg-surface-2 border border-accent text-ink font-display text-xl focus:outline-none"
              placeholder="Playlist title"
            />
            <textarea
              bind:value={editDescription}
              rows="2"
              class="px-3 py-1.5 rounded-xs bg-surface-2 border border-border text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent resize-none"
              placeholder="Add an optional description"
            ></textarea>
            <div class="flex items-center gap-2 mt-1">
              <Button variant="solid" onclick={saveMetadata}>Save</Button>
              <Button variant="ghost" onclick={() => (isEditing = false)}>Cancel</Button>
            </div>
          </div>
        {:else}
          <div class="flex items-center gap-3 mt-1 mb-2 max-w-full">
            <h1 class="font-display text-lg sm:text-xl text-ink font-normal leading-tight break-words">
              {pl.title}
            </h1>
            {#if isEditablePlaylist}
              <button
                type="button"
                onclick={() => (isEditing = true)}
                class="text-ink-muted hover:text-ink p-1 rounded-xs transition-colors shrink-0"
                aria-label="Edit playlist details"
              >
                <PencilSimple size={18} weight="light" />
              </button>
            {/if}
          </div>

          {#if pl.description}
            <p class="text-xs sm:text-sm text-ink-muted max-w-xl mb-3 line-clamp-2">
              {pl.description}
            </p>
          {/if}
        {/if}

        <div class="flex items-center gap-2 text-xs text-ink-muted mb-4 font-mono" data-numeric>
          <span>{items.length} {items.length === 1 ? 'track' : 'tracks'}</span>
          <span>·</span>
          <span>{formatDurationMs(totalDurationMs)}</span>
        </div>

        <!-- Action buttons: Play, Shuffle, Delete -->
        <div class="flex flex-wrap items-center justify-center sm:justify-start gap-3">
          {#if items.length > 0}
            <Button variant="solid" onclick={playAll}>
              <Play size={16} />
              <span>Play</span>
            </Button>
            <Button variant="outline" onclick={shuffleAll}>
              <Shuffle size={16} />
              <span>Shuffle</span>
            </Button>
          {/if}

          {#if isEditablePlaylist}
            <Button variant="ghost" onclick={deletePlaylist} title="Delete playlist">
              <Trash size={16} weight="light" class="text-danger" />
              <span class="text-danger">Delete</span>
            </Button>
          {/if}
        </div>
      </div>
    </header>

    <!-- Playlist Track List with Drag & Drop Reorder -->
    {#if items.length === 0}
      <EmptyState
        title="This playlist is empty"
        description="Search for tracks and click 'Add to playlist' to build your collection."
      />
    {:else}
      <div class="flex flex-col gap-1 w-full" aria-label="Playlist tracks">
        <!-- Table Column Headers -->
        <div
          class="playlist-row-grid grid items-center gap-3 px-2 pb-2 text-2xs uppercase tracking-wide text-ink-faint border-b border-border max-sm:hidden"
        >
          <span></span>
          <span class="text-right" data-numeric>#</span>
          <span>Title</span>
          <span></span>
          <span class="text-right">Time</span>
          <span class="text-right">Actions</span>
        </div>

        <div class="flex flex-col divide-y divide-border/30">
          {#each items as item, idx (item.itemId)}
            {@const isCurrent = player.currentTrack?.id === item.track.id}
            {@const isDragging = draggedIndex === idx}
            {@const isOver = dragOverIndex === idx}

            <div
              draggable={isEditablePlaylist}
              role="listitem"
              ondragstart={(e) => handleDragStart(idx, e)}
              ondragover={(e) => handleDragOver(idx, e)}
              ondrop={(e) => handleDrop(idx, e)}
              class="playlist-row-grid group grid items-center gap-3 rounded-xs px-2 py-2 text-sm transition-colors border-y border-transparent"
              class:bg-surface-2={isCurrent}
              class:hover:bg-surface-1={!isCurrent}
              class:opacity-40={isDragging}
              class:border-t-accent={isOver && draggedIndex !== null && draggedIndex > idx}
              class:border-b-accent={isOver && draggedIndex !== null && draggedIndex < idx}
            >
              <!-- Drag Handle: desktop-only. Native HTML5 drag-and-drop has no touch equivalent (it simply
                   never fires on mobile browsers), so this column doesn't exist at all below sm — see
                   .playlist-row-grid — and Actions' Move Up/Down buttons are the reorder mechanism there,
                   since those already work on touch. Also empty for a non-editable (JioSaavn) playlist,
                   the same way Actions already is, so it doesn't waste space showing a handle that would
                   silently do nothing. -->
              <div
                class="cursor-grab active:cursor-grabbing text-ink-faint group-hover:text-ink-muted flex items-center justify-center max-sm:hidden"
                title={isEditablePlaylist ? 'Drag to reorder' : undefined}
                aria-label={isEditablePlaylist ? 'Reorder handle' : undefined}
              >
                {#if isEditablePlaylist}
                  <DotsSixVertical size={16} weight="bold" />
                {/if}
              </div>

              <!-- Index or Play button -->
              <button
                type="button"
                onclick={() => player.playTrack(item.track, items.map((it) => it.track))}
                class="relative flex items-center justify-center text-ink-faint hover:text-ink"
                aria-label={`Play ${item.track.title}`}
              >
                <span class="font-mono text-xs group-hover:opacity-0" class:opacity-0={isCurrent} data-numeric>
                  {idx + 1}
                </span>
                <span
                  class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100"
                  class:opacity-100={isCurrent}
                >
                  <Play size={14} />
                </span>
              </button>

              <!-- Track Artwork, Title & Artist -->
              <div class="flex items-center gap-3 min-w-0">
                <Artwork
                  src={item.track.images?.[0]?.url ?? item.track.album?.images?.[0]?.url}
                  alt=""
                  size={36}
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium" class:text-accent={isCurrent} class:text-ink={!isCurrent}>
                    {item.track.title}
                  </p>
                  <p class="truncate text-xs text-ink-muted mt-0.5">
                    <ArtistLinks artists={item.track.artists} />
                  </p>
                </div>
              </div>

              <!-- Liked status: desktop-only, reclaiming its column for the title on mobile -->
              <div class="flex items-center justify-center max-sm:hidden">
                {#if likedIds.has(item.track.id)}
                  <Heart size={14} weight="fill" class="text-accent" />
                {/if}
              </div>

              <!-- Duration -->
              <span class="font-mono text-xs text-ink-muted text-right max-sm:hidden" data-numeric>
                {formatDurationMs(item.track.durationMs)}
              </span>

              <!-- Actions: Keyboard Move Up/Down + Remove Item. Full opacity on mobile since it's the
                   reorder mechanism there now (see the drag handle above), not just a hover affordance. -->
              <div class="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 max-sm:opacity-100">
                {#if isEditablePlaylist}
                <button
                  type="button"
                  onclick={() => moveUp(idx)}
                  disabled={idx === 0}
                  class="p-1 text-ink-faint hover:text-ink disabled:opacity-20 disabled:hover:text-ink-faint transition-colors"
                  aria-label="Move track up"
                  title="Move track up"
                >
                  <ArrowUp size={14} weight="bold" />
                </button>
                <button
                  type="button"
                  onclick={() => moveDown(idx)}
                  disabled={idx === items.length - 1}
                  class="p-1 text-ink-faint hover:text-ink disabled:opacity-20 disabled:hover:text-ink-faint transition-colors"
                  aria-label="Move track down"
                  title="Move track down"
                >
                  <ArrowDown size={14} weight="bold" />
                </button>
                  <button
                    type="button"
                    onclick={() => removeItem(item.itemId, item.track.title)}
                    class="p-1 text-ink-faint hover:text-danger transition-colors ml-1"
                    aria-label={`Remove ${item.track.title} from playlist`}
                    title="Remove from playlist"
                  >
                    <Trash size={14} weight="light" />
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* Header and row share one template so columns line up — see TrackTable for the same pattern. Column
     count itself changes at sm (not just widths): drag/liked/duration don't exist below sm rather than
     existing at zero width, so the count here must always match how many cells actually render — see the
     max-sm:hidden columns above. */
  .playlist-row-grid {
    grid-template-columns: 28px minmax(0, 1fr) auto;
  }
  @media (min-width: 640px) {
    .playlist-row-grid {
      grid-template-columns: 24px 28px minmax(0, 1fr) 20px 48px auto;
    }
  }
</style>
