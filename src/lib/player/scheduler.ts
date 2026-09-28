import { api } from '$lib/api/client';
import type { Audio, Track } from '$lib/types';
import type { AudioGraph } from './audio-graph';

export interface SchedulerCallbacks {
  onNextTrackReady?: (track: Track, audio: Audio) => void;
  onTrackTransition?: (track: Track, audio: Audio, newIndex: number) => void;
  onEndOfQueue?: () => void;
  onPrefetchDone?: (trackIds: string[]) => void;
}

export class Scheduler {
  private audioGraph: AudioGraph;
  private callbacks: SchedulerCallbacks;
  private prefetchTimeout: ReturnType<typeof setTimeout> | null = null;
  private preloadedTrack: Track | null = null;
  private preloadedAudio: Audio | null = null;
  private preloadedIndex: number | null = null;
  private isPreloading = false;
  private isCrossfadeTriggered = false;

  constructor(audioGraph: AudioGraph, callbacks: SchedulerCallbacks = {}) {
    this.audioGraph = audioGraph;
    this.callbacks = callbacks;
  }

  get preloadedTrackInfo(): { track: Track; audio: Audio; index: number } | null {
    if (this.preloadedTrack && this.preloadedAudio && this.preloadedIndex != null) {
      return {
        track: this.preloadedTrack,
        audio: this.preloadedAudio,
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
    this.preloadedAudio = null;
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
      const { data, error } = await api.GET('/v1/tracks/{id}/audio', {
        params: { path: { id: nextTrack.id } },
      });

      if (error || !data?.url) {
        console.warn('[Scheduler] Failed to resolve audio for preloading:', error);
        this.isPreloading = false;
        return;
      }

      this.preloadedTrack = nextTrack;
      this.preloadedAudio = data;
      this.preloadedIndex = nextIdx;
      this.isPreloading = false;
      this.isCrossfadeTriggered = false;

      // Preload into the idle audio element
      this.audioGraph.preload(data.url);
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
      !this.preloadedAudio ||
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
      const targetAudio = this.preloadedAudio;
      const targetIndex = this.preloadedIndex;

      this.audioGraph.startCrossfade(crossfadeSeconds, () => {
        this.clearPreload();
        this.callbacks.onTrackTransition?.(targetTrack, targetAudio, targetIndex);
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

    if (this.preloadedTrack && this.preloadedAudio && this.preloadedIndex != null) {
      const targetTrack = this.preloadedTrack;
      const targetAudio = this.preloadedAudio;
      const targetIndex = this.preloadedIndex;

      this.clearPreload();
      // Notify before swapping, not after: swapToPreloaded() makes the new element active immediately, and
      // its DOM events (durationchange, timeupdate, playing) are routed to the engine the instant they fire,
      // which can happen before its own play() promise resolves. The transition must already be applied by
      // then, or those events land against the track that's still displayed instead of the one that's now
      // actually playing. Same reasoning as PlayerEngine.next()'s preloaded-swap path.
      this.callbacks.onTrackTransition?.(targetTrack, targetAudio, targetIndex);
      await this.audioGraph.swapToPreloaded();
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
