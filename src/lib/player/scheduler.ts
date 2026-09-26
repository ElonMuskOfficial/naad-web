import { api } from '$lib/api/client';
import type { paths } from '$lib/api/schema';
import type { Track } from '$lib/types';
import type { AudioGraph } from './audio-graph';

export type ResolvedSources =
  paths['/v1/tracks/{id}/sources']['get']['responses'][200]['content']['application/json'];

export interface SchedulerCallbacks {
  onNextTrackReady?: (track: Track, sources: ResolvedSources) => void;
  onTrackTransition?: (track: Track, sources: ResolvedSources, newIndex: number) => void;
  onEndOfQueue?: () => void;
  onPrefetchDone?: (trackIds: string[]) => void;
}

export class Scheduler {
  private audioGraph: AudioGraph;
  private callbacks: SchedulerCallbacks;
  private prefetchTimeout: ReturnType<typeof setTimeout> | null = null;
  private preloadedTrack: Track | null = null;
  private preloadedSources: ResolvedSources | null = null;
  private preloadedIndex: number | null = null;
  private isPreloading = false;
  private isCrossfadeTriggered = false;

  constructor(audioGraph: AudioGraph, callbacks: SchedulerCallbacks = {}) {
    this.audioGraph = audioGraph;
    this.callbacks = callbacks;
  }

  get preloadedTrackInfo(): { track: Track; sources: ResolvedSources; index: number } | null {
    if (this.preloadedTrack && this.preloadedSources && this.preloadedIndex != null) {
      return {
        track: this.preloadedTrack,
        sources: this.preloadedSources,
        index: this.preloadedIndex,
      };
    }
    return null;
  }

  /**
   * Called whenever queue or queue index changes. Debounces prefetch requests (1000ms)
   * to respect the 60/min rate limit budget.
   */
  queueChanged(queue: Track[], currentIndex: number) {
    if (this.prefetchTimeout) {
      clearTimeout(this.prefetchTimeout);
      this.prefetchTimeout = null;
    }

    const upcoming = queue.slice(currentIndex + 1, currentIndex + 11);
    const trackIds = upcoming.map((t) => t.id).filter(Boolean);

    if (trackIds.length === 0) return;

    this.prefetchTimeout = setTimeout(async () => {
      this.prefetchTimeout = null;
      try {
        await api.POST('/v1/player/prefetch', {
          body: { trackIds },
        });
        this.callbacks.onPrefetchDone?.(trackIds);
      } catch (err) {
        // Prefetch is an optimization; log and ignore network/rate errors
        console.debug('[Scheduler] Prefetch request completed/failed:', err);
      }
    }, 1000);
  }

  /**
   * Clears any active preloaded track (e.g. if the user skips or jumps manually).
   */
  clearPreload() {
    this.preloadedTrack = null;
    this.preloadedSources = null;
    this.preloadedIndex = null;
    this.isPreloading = false;
    this.isCrossfadeTriggered = false;
  }

  /**
   * Computes the next track index given current index, queue, and repeat mode.
   */
  getNextIndex(currentIndex: number, queueLength: number, repeat: 'off' | 'all' | 'one'): number {
    if (queueLength === 0) return -1;
    if (repeat === 'one') return currentIndex;
    if (currentIndex + 1 < queueLength) {
      return currentIndex + 1;
    }
    if (repeat === 'all') {
      return 0;
    }
    return -1;
  }

  /**
   * Preloads the next track into the idle audio element for gapless handoff.
   */
  async prepareNextTrack(queue: Track[], currentIndex: number, repeat: 'off' | 'all' | 'one'): Promise<void> {
    const nextIdx = this.getNextIndex(currentIndex, queue.length, repeat);
    if (nextIdx < 0 || nextIdx >= queue.length) {
      this.clearPreload();
      return;
    }

    const nextTrack = queue[nextIdx];
    if (!nextTrack) return;

    // If already preloaded for this track, do nothing
    if (this.preloadedTrack?.id === nextTrack.id && this.preloadedIndex === nextIdx) {
      return;
    }

    if (this.isPreloading) return;
    this.clearPreload();
    this.isPreloading = true;

    try {
      const { data, error } = await api.GET('/v1/tracks/{id}/sources', {
        params: {
          path: { id: nextTrack.id },
        },
      });

      if (error || !data || !data.play?.url) {
        console.warn('[Scheduler] Failed to resolve source for preloading:', error);
        this.isPreloading = false;
        return;
      }

      this.preloadedTrack = nextTrack;
      this.preloadedSources = data;
      this.preloadedIndex = nextIdx;
      this.isPreloading = false;
      this.isCrossfadeTriggered = false;

      // Preload into the idle audio element
      this.audioGraph.preload(data.play.url, data.play.normalization?.gainDb);
      this.callbacks.onNextTrackReady?.(nextTrack, data);
    } catch (err) {
      console.warn('[Scheduler] Preload error:', err);
      this.isPreloading = false;
    }
  }

  /**
   * Checks whether crossfade should be triggered during playback.
   * Crossfade is explicitly SKIPPED between consecutive tracks of the same album
   * so continuous albums remain truly gapless.
   */
  checkCrossfade(
    currentTrack: Track | null,
    currentTime: number,
    duration: number,
    crossfadeSeconds: number,
  ): boolean {
    if (
      crossfadeSeconds <= 0 ||
      duration <= crossfadeSeconds ||
      this.isCrossfadeTriggered ||
      !this.preloadedTrack ||
      !this.preloadedSources ||
      this.preloadedIndex == null
    ) {
      return false;
    }

    // Skip crossfade if consecutive tracks belong to the same album
    const isSameAlbum = Boolean(
      currentTrack?.album?.id &&
        this.preloadedTrack.album?.id &&
        currentTrack.album.id === this.preloadedTrack.album.id,
    );

    if (isSameAlbum) {
      return false;
    }

    const remainingTime = duration - currentTime;
    if (remainingTime <= crossfadeSeconds && remainingTime > 0) {
      this.isCrossfadeTriggered = true;
      const targetTrack = this.preloadedTrack;
      const targetSources = this.preloadedSources;
      const targetIndex = this.preloadedIndex;

      this.audioGraph.startCrossfade(crossfadeSeconds, () => {
        this.clearPreload();
        this.callbacks.onTrackTransition?.(targetTrack, targetSources, targetIndex);
      });
      return true;
    }

    return false;
  }

  /**
   * Handles track ended event: swaps to preloaded element if available,
   * or signals end of queue.
   */
  async handleTrackEnded(
    queue: Track[],
    currentIndex: number,
    repeat: 'off' | 'all' | 'one',
  ): Promise<boolean> {
    if (this.isCrossfadeTriggered) {
      // Crossfade is already in progress / handled the swap
      return true;
    }

    if (this.preloadedTrack && this.preloadedSources && this.preloadedIndex != null) {
      const targetTrack = this.preloadedTrack;
      const targetSources = this.preloadedSources;
      const targetIndex = this.preloadedIndex;

      this.clearPreload();
      await this.audioGraph.swapToPreloaded();
      this.callbacks.onTrackTransition?.(targetTrack, targetSources, targetIndex);
      return true;
    }

    // If preloaded track was not ready, check if there's a next index to load
    const nextIdx = this.getNextIndex(currentIndex, queue.length, repeat);
    if (nextIdx < 0 || nextIdx >= queue.length) {
      this.callbacks.onEndOfQueue?.();
      return false;
    }

    return false;
  }

  destroy() {
    if (this.prefetchTimeout) {
      clearTimeout(this.prefetchTimeout);
      this.prefetchTimeout = null;
    }
    this.clearPreload();
  }
}
