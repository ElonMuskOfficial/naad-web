<script lang="ts">
import { page } from '$app/state';
import Books from 'phosphor-svelte/lib/Books';
import Broadcast from 'phosphor-svelte/lib/Broadcast';
import Gear from 'phosphor-svelte/lib/Gear';
import House from 'phosphor-svelte/lib/House';
import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';

function isNavActive(path: string): boolean {
  if (path === '/') return page.url.pathname === '/';
  return page.url.pathname.startsWith(path);
}
</script>

<nav
  class="flex h-14 shrink-0 items-center justify-around border-t border-border bg-surface-1 px-2 select-none sm:hidden pb-[env(safe-area-inset-bottom)]"
  aria-label="Mobile Navigation"
>
  <a
    href="/"
    class="flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] transition-colors
      {isNavActive('/') ? 'text-accent font-medium' : 'text-ink-muted hover:text-ink'}"
  >
    <House size={20} weight={isNavActive('/') ? 'regular' : 'light'} />
    <span>Home</span>
  </a>

  <a
    href="/search"
    class="flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] transition-colors
      {isNavActive('/search') ? 'text-accent font-medium' : 'text-ink-muted hover:text-ink'}"
  >
    <MagnifyingGlass size={20} weight={isNavActive('/search') ? 'regular' : 'light'} />
    <span>Search</span>
  </a>

  <a
    href="/library"
    class="flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] transition-colors
      {isNavActive('/library') ? 'text-accent font-medium' : 'text-ink-muted hover:text-ink'}"
  >
    <Books size={20} weight={isNavActive('/library') ? 'regular' : 'light'} />
    <span>Library</span>
  </a>

  <a
    href="/stations"
    class="flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] transition-colors
      {isNavActive('/stations') ? 'text-accent font-medium' : 'text-ink-muted hover:text-ink'}"
  >
    <Broadcast size={20} weight={isNavActive('/stations') ? 'regular' : 'light'} />
    <span>Stations</span>
  </a>

  <a
    href="/settings"
    class="flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] transition-colors
      {isNavActive('/settings') ? 'text-accent font-medium' : 'text-ink-muted hover:text-ink'}"
  >
    <Gear size={20} weight={isNavActive('/settings') ? 'regular' : 'light'} />
    <span>Settings</span>
  </a>
</nav>
