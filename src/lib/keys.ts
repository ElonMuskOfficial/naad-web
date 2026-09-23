import type { PlayerEngine } from './player/engine.svelte';
import { theme } from './theme.svelte';

export interface CommandAction {
  id: string;
  title: string;
  category: 'Navigation' | 'Playback' | 'Appearance' | 'Library';
  shortcut?: string[];
  keywords?: string[];
  perform: (ctx: CommandContext) => void | Promise<void>;
}

export interface CommandContext {
  player: PlayerEngine;
  goto: (url: string) => void;
  togglePalette: () => void;
  likeCurrentTrack?: () => void;
}

export const COMMAND_ACTIONS: CommandAction[] = [
  // Navigation
  {
    id: 'nav-home',
    title: 'Go to Home',
    category: 'Navigation',
    keywords: ['discover', 'explore', 'feed'],
    perform: ({ goto }) => goto('/'),
  },
  {
    id: 'nav-search',
    title: 'Search Catalog',
    category: 'Navigation',
    shortcut: ['/'],
    keywords: ['find', 'query', 'tracks', 'artists', 'albums'],
    perform: ({ goto }) => goto('/search'),
  },
  {
    id: 'nav-library',
    title: 'Go to Library',
    category: 'Navigation',
    keywords: ['saved', 'collection', 'playlists', 'history'],
    perform: ({ goto }) => goto('/library'),
  },
  {
    id: 'nav-import',
    title: 'Import Playlist (Spotify, Apple, YouTube)',
    category: 'Navigation',
    keywords: ['transfer', 'convert', 'link', 'migrate'],
    perform: ({ goto }) => goto('/import'),
  },
  {
    id: 'nav-settings',
    title: 'Open Settings',
    category: 'Navigation',
    keywords: ['preferences', 'api key', 'quality', 'engine'],
    perform: ({ goto }) => goto('/settings'),
  },

  // Playback
  {
    id: 'play-toggle',
    title: 'Play / Pause',
    category: 'Playback',
    shortcut: ['Space'],
    keywords: ['playback', 'resume', 'stop'],
    perform: ({ player }) => {
      if (player.status === 'playing') {
        player.pause();
      } else {
        player.play();
      }
    },
  },
  {
    id: 'play-next',
    title: 'Next Track',
    category: 'Playback',
    shortcut: ['Shift', '→'],
    keywords: ['skip', 'forward'],
    perform: ({ player }) => player.next(),
  },
  {
    id: 'play-prev',
    title: 'Previous Track',
    category: 'Playback',
    shortcut: ['Shift', '←'],
    keywords: ['back', 'restart'],
    perform: ({ player }) => player.previous(),
  },
  {
    id: 'play-seek-fwd',
    title: 'Seek Forward 5s',
    category: 'Playback',
    shortcut: ['→'],
    keywords: ['fast forward'],
    perform: ({ player }) => player.seek(Math.min(player.duration, player.currentTime + 5)),
  },
  {
    id: 'play-seek-back',
    title: 'Seek Backward 5s',
    category: 'Playback',
    shortcut: ['←'],
    keywords: ['rewind'],
    perform: ({ player }) => player.seek(Math.max(0, player.currentTime - 5)),
  },
  {
    id: 'play-like',
    title: 'Like Current Track',
    category: 'Playback',
    shortcut: ['L'],
    keywords: ['favorite', 'save', 'heart'],
    perform: ({ likeCurrentTrack }) => likeCurrentTrack?.(),
  },
  {
    id: 'play-shuffle',
    title: 'Toggle Shuffle',
    category: 'Playback',
    keywords: ['random', 'mix'],
    perform: ({ player }) => player.toggleShuffle(),
  },
  {
    id: 'play-repeat',
    title: 'Cycle Repeat Mode',
    category: 'Playback',
    keywords: ['loop', 'all', 'one'],
    perform: ({ player }) => player.toggleRepeat(),
  },
  {
    id: 'play-panel',
    title: 'Toggle Up Next & Lyrics Panel',
    category: 'Playback',
    keywords: ['sidebar', 'queue', 'lyrics'],
    perform: ({ player }) => player.toggleRightPanel(),
  },
  {
    id: 'play-nowplaying',
    title: 'Open Now Playing (Full Screen)',
    category: 'Playback',
    keywords: ['lyrics', 'stage', 'cover', 'signal'],
    perform: ({ goto }) => goto('/now-playing'),
  },

  // Appearance
  {
    id: 'theme-toggle',
    title: 'Toggle Dark / Light Theme',
    category: 'Appearance',
    keywords: ['mode', 'color', 'paper'],
    perform: () => theme.toggle(),
  },
  {
    id: 'theme-dark',
    title: 'Switch to Dark Theme',
    category: 'Appearance',
    keywords: ['night', 'warm black'],
    perform: () => theme.set('dark'),
  },
  {
    id: 'theme-light',
    title: 'Switch to Light Theme',
    category: 'Appearance',
    keywords: ['day', 'paper'],
    perform: () => theme.set('light'),
  },
];

/**
 * Global keyboard event handler.
 * Prevents playback hotkeys when focused in editable fields.
 */
export function handleGlobalKeydown(e: KeyboardEvent, ctx: CommandContext) {
  const target = e.target as HTMLElement | null;
  const isInput =
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable);

  // Command palette toggle (Ctrl+K or Cmd+K)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    ctx.togglePalette();
    return;
  }

  // Do not run playback shortcuts if user is typing
  if (isInput) return;

  // Search shortcut '/'
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    ctx.goto('/search');
    return;
  }

  // Play / Pause: Space
  if (e.code === 'Space') {
    e.preventDefault();
    if (ctx.player.status === 'playing') {
      ctx.player.pause();
    } else {
      ctx.player.play();
    }
    return;
  }

  // Next / Previous: Shift + ArrowRight / Shift + ArrowLeft
  if (e.shiftKey && e.code === 'ArrowRight') {
    e.preventDefault();
    ctx.player.next();
    return;
  }
  if (e.shiftKey && e.code === 'ArrowLeft') {
    e.preventDefault();
    ctx.player.previous();
    return;
  }

  // Seek: ArrowRight / ArrowLeft
  if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.code === 'ArrowRight') {
      e.preventDefault();
      ctx.player.seek(Math.min(ctx.player.duration, ctx.player.currentTime + 5));
      return;
    }
    if (e.code === 'ArrowLeft') {
      e.preventDefault();
      ctx.player.seek(Math.max(0, ctx.player.currentTime - 5));
      return;
    }
  }

  // Like current track: 'l' or 'L'
  if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    ctx.likeCurrentTrack?.();
    return;
  }
}
