import { joinArtists } from '$lib/format';
import type { Track } from '$lib/types';

export interface MediaSessionActionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSeekTo?: (time: number) => void;
  onSeekBackward?: (offset: number) => void;
  onSeekForward?: (offset: number) => void;
}

export class MediaSessionController {
  private isSupported: boolean;
  private lastPositionUpdate = 0;

  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'mediaSession' in navigator;
  }

  setMetadata(track: Track | null) {
    if (!this.isSupported) return;

    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const images = track.images?.length ? track.images : (track.album?.images ?? []);
    const artwork: MediaImage[] = images.map((img) => ({
      src: img.url,
      sizes: img.width ? `${img.width}x${img.height ?? img.width}` : '512x512',
    }));

    if (artwork.length === 0 && images[0]?.url) {
      artwork.push({ src: images[0].url, sizes: '512x512' });
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: joinArtists(track.artists),
        album: track.album?.title ?? '',
        artwork,
      });
    } catch (e) {
      console.warn('[MediaSession] Failed to set metadata:', e);
    }
  }

  setPlaybackState(status: 'playing' | 'paused' | 'idle' | 'loading') {
    if (!this.isSupported) return;
    try {
      navigator.mediaSession.playbackState =
        status === 'playing' ? 'playing' : status === 'paused' ? 'paused' : 'none';
    } catch {
      // ignore
    }
  }

  setPositionState(duration: number, position: number, playbackRate = 1) {
    if (!this.isSupported || typeof navigator.mediaSession.setPositionState !== 'function') return;

    // Throttle to max once every 800ms unless stopped
    const now = performance.now();
    if (now - this.lastPositionUpdate < 800) {
      return;
    }
    this.lastPositionUpdate = now;

    if (
      Number.isFinite(duration) &&
      duration > 0 &&
      Number.isFinite(position) &&
      position >= 0 &&
      position <= duration
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate,
          position,
        });
      } catch {
        // Can throw if duration or position changes unexpectedly
      }
    }
  }

  setActionHandlers(handlers: MediaSessionActionHandlers) {
    if (!this.isSupported) return;

    const actionMap: Array<[MediaSessionAction, ((details: MediaSessionActionDetails) => void) | null]> = [
      ['play', handlers.onPlay ? () => handlers.onPlay?.() : null],
      ['pause', handlers.onPause ? () => handlers.onPause?.() : null],
      ['previoustrack', handlers.onPrevious ? () => handlers.onPrevious?.() : null],
      ['nexttrack', handlers.onNext ? () => handlers.onNext?.() : null],
      [
        'seekto',
        handlers.onSeekTo
          ? (details) => {
              if (details.seekTime != null) {
                handlers.onSeekTo?.(details.seekTime);
              }
            }
          : null,
      ],
      [
        'seekbackward',
        handlers.onSeekBackward
          ? (details) => {
              handlers.onSeekBackward?.(details.seekOffset ?? 10);
            }
          : null,
      ],
      [
        'seekforward',
        handlers.onSeekForward
          ? (details) => {
              handlers.onSeekForward?.(details.seekOffset ?? 10);
            }
          : null,
      ],
    ];

    for (const [action, handler] of actionMap) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some actions might not be supported on all browsers
      }
    }
  }
}
