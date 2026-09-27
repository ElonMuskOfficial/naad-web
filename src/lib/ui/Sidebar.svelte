<script lang="ts">
import { page } from '$app/state';
import { createLibraryPlaylistsQuery } from '$lib/queries';
import { theme } from '$lib/theme.svelte';
import Books from 'phosphor-svelte/lib/Books';
import Broadcast from 'phosphor-svelte/lib/Broadcast';
import Gear from 'phosphor-svelte/lib/Gear';
import House from 'phosphor-svelte/lib/House';
import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
import Moon from 'phosphor-svelte/lib/Moon';
import Sun from 'phosphor-svelte/lib/Sun';
import Skeleton from './Skeleton.svelte';

const playlistsQuery = createLibraryPlaylistsQuery();

function isNavActive(path: string): boolean {
  if (path === '/') return page.url.pathname === '/';
  return page.url.pathname.startsWith(path);
}
</script>

<aside
  class="flex h-full w-56 flex-col shrink-0 border-r border-border bg-surface-1 select-none max-sm:hidden"
  aria-label="Main Navigation"
>
  <!-- Wordmark Header -->
  <div class="flex h-14 items-center justify-between px-4 border-b border-border">
    <a href="/" class="flex items-center gap-2 group">
      <span class="font-display text-lg font-semibold tracking-tight text-ink group-hover:text-accent transition-colors">
        NAAD
      </span>
    </a>
  </div>

  <!-- Primary Navigation -->
  <nav class="flex flex-col gap-1 p-2">
    <a
      href="/"
      class="flex items-center gap-3 px-3 py-2 rounded-xs text-sm transition-colors duration-[var(--duration-fast)]
        {isNavActive('/') ? 'bg-surface-2 text-ink font-medium' : 'text-ink-muted hover:text-ink hover:bg-surface-2/60'}"
    >
      <House size={18} weight="light" class={isNavActive('/') ? 'text-accent' : ''} />
      <span>Home</span>
    </a>

    <a
      href="/search"
      class="flex items-center gap-3 px-3 py-2 rounded-xs text-sm transition-colors duration-[var(--duration-fast)]
        {isNavActive('/search') ? 'bg-surface-2 text-ink font-medium' : 'text-ink-muted hover:text-ink hover:bg-surface-2/60'}"
    >
      <MagnifyingGlass size={18} weight="light" class={isNavActive('/search') ? 'text-accent' : ''} />
      <span>Search</span>
    </a>

    <a
      href="/library"
      class="flex items-center gap-3 px-3 py-2 rounded-xs text-sm transition-colors duration-[var(--duration-fast)]
        {isNavActive('/library') ? 'bg-surface-2 text-ink font-medium' : 'text-ink-muted hover:text-ink hover:bg-surface-2/60'}"
    >
      <Books size={18} weight="light" class={isNavActive('/library') ? 'text-accent' : ''} />
      <span>Library</span>
    </a>

    <a
      href="/stations"
      class="flex items-center gap-3 px-3 py-2 rounded-xs text-sm transition-colors duration-[var(--duration-fast)]
        {isNavActive('/stations') ? 'bg-surface-2 text-ink font-medium' : 'text-ink-muted hover:text-ink hover:bg-surface-2/60'}"
    >
      <Broadcast size={18} weight="light" class={isNavActive('/stations') ? 'text-accent' : ''} />
      <span>Stations</span>
    </a>
  </nav>

  <!-- Divider -->
  <div class="mx-3 my-1 border-b border-border"></div>

  <!-- Playlists Section -->
  <div class="flex-1 overflow-y-auto px-2 py-2">
    <div class="px-3 py-1 flex items-center justify-between">
      <span class="font-mono text-2xs uppercase tracking-wider text-ink-faint">
        Playlists
      </span>
    </div>

    <div class="mt-1 flex flex-col gap-0.5">
      {#if playlistsQuery.isPending}
        <div class="flex flex-col gap-2 p-2">
          <Skeleton class="h-3 w-3/4" />
          <Skeleton class="h-3 w-1/2" />
          <Skeleton class="h-3 w-2/3" />
        </div>
      {:else if playlistsQuery.isError}
        <p class="px-3 py-1 text-xs text-ink-faint">Playlists unavailable</p>
      {:else if playlistsQuery.data && playlistsQuery.data.length > 0}
        {#each playlistsQuery.data as playlist (playlist.id)}
          <a
            href="/playlist/{playlist.id}"
            class="truncate px-3 py-1.5 rounded-xs text-xs transition-colors duration-[var(--duration-fast)]
              {isNavActive(`/playlist/${playlist.id}`)
                ? 'bg-surface-2 text-ink font-medium'
                : 'text-ink-muted hover:text-ink hover:bg-surface-2/60'}"
            title={playlist.title}
          >
            {playlist.title}
          </a>
        {/each}
      {:else}
        <p class="px-3 py-1 text-xs text-ink-faint">No playlists yet</p>
      {/if}
    </div>
  </div>

  <!-- Footer Actions -->
  <div class="border-t border-border p-2 flex items-center justify-between">
    <a
      href="/settings"
      class="flex items-center gap-2 px-2.5 py-1.5 rounded-xs text-xs text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
      title="Settings"
    >
      <Gear size={16} weight="light" />
      <span>Settings</span>
    </a>

    <button
      type="button"
      onclick={() => theme.toggle()}
      class="inline-flex size-7 items-center justify-center rounded-xs text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
      aria-label="Toggle {theme.current === 'dark' ? 'light' : 'dark'} mode"
      title="Toggle {theme.current === 'dark' ? 'light' : 'dark'} mode"
    >
      {#if theme.current === 'dark'}
        <Sun size={16} weight="light" />
      {:else}
        <Moon size={16} weight="light" />
      {/if}
    </button>
  </div>
</aside>
