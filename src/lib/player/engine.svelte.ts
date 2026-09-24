import { api } from '$lib/api/client';
import { toast } from '$lib/toast.svelte';
import type { Source, Track, TrackQuality } from '$lib/types';
import { AudioGraph } from './audio-graph';
import { HistoryTracker } from './history';
import { formatIsoWithOffset, isTokenExpiringSoon, shuffleArray } from './math';
import { MediaSessionController } from './media-session';
import { type QualityTier, type ResolvedSources, Scheduler } from './scheduler';

export const VOLUME_STORAGE_KEY = 'naad:volume';
export const QUALITY_STORAGE_KEY = 'naad:quality';
export const CROSSFADE_STORAGE_KEY = 'naad:crossfade';
export const NORMALIZATION_STORAGE_KEY = 'naad:normalization';
export const SESSION_TRACK_KEY = 'naad:current_track';
export const SESSION_QUEUE_KEY = 'naad:queue';
export const SESSION_QUEUE_INDEX_KEY = 'naad:queue_index';

export class PlayerEngine {
  // Playback state (Svelte 5 runes)
  currentTrack = $state<Track | null>(null);
  selectedSource = $state<Source | null>(null);
  alternatives = $state<Source[]>([]);
  currentPlayUrl = $state<string | null>(null);
  currentExpiresAt = $state<string | null>(null);
  status = $state<'idle' | 'playing' | 'paused' | 'loading'>('idle');
  currentTime = $state<number>(0);
  duration = $state<number>(0);
  buffered = $state<number>(0);
  volume = $state<number>(0.85);
  muted = $state<boolean>(false);
  repeat = $state<'off' | 'all' | 'one'>('off');
  shuffle = $state<boolean>(false);
  crossfadeSeconds = $state<number>(0);
  quality = $state<QualityTier>('max');
  normalizationEnabled = $state<boolean>(true);
  queue = $state<Track[]>([]);
  queueIndex = $state<number>(0);
  measuredGapMs = $state<number | null>(null);
  resolvedQualities = $state<Record<string, Source | TrackQuality>>({});

  // UI state
  activeTab = $state<'queue' | 'lyrics'>('queue');
  rightPanelOpen = $state<boolean>(true);

  // Internal subsystems & helpers
  private audioGraph: AudioGraph;
  private historyTracker: HistoryTracker;
  private mediaSession: MediaSessionController;
  private scheduler: Scheduler;
  private unshuffledQueue: Track[] = [];
  private listenContext?: { type: string; id: string };
  private listenStartTime: number | null = null;
  private listenStartIso: string = formatIsoWithOffset();
  private retryCount = 0;
  private isRefreshingToken = false;

  constructor() {
    this.readStoredSettings();

    this.audioGraph = new AudioGraph({
      onTimeUpdate: (time) => {
        if (!this.currentTrack) {
          this.audioGraph.pause();
          return;
        }
        this.currentTime = time;
        this.mediaSession.setPositionState(this.duration, time);
        this.scheduler.checkCrossfade(this.currentTrack, time, this.duration, this.crossfadeSeconds);
        this.checkProactiveExpiry();
      },
      onDurationChange: (dur) => {
        if (Number.isFinite(dur) && dur > 0) {
          this.duration = dur;
        }
      },
      onBuffered: (buf) => {
        this.buffered = buf;
      },
      onPlaying: () => {
        if (!this.currentTrack) {
          this.audioGraph.pause();
          return;
        }
        this.status = 'playing';
        this.mediaSession.setPlaybackState('playing');
      },
      onPause: () => {
        if (this.status !== 'loading') {
          this.status = 'paused';
          this.mediaSession.setPlaybackState('paused');
        }
      },
      onWaiting: () => {
        this.status = 'loading';
      },
      onEnded: () => {
        this.handleTrackEnded();
      },
      onError: (err) => {
        this.handleAudioError(err);
      },
      onGapMeasured: (gapMs) => {
        this.measuredGapMs = gapMs;
      },
    });

    this.historyTracker = new HistoryTracker();
    this.mediaSession = new MediaSessionController();

    this.mediaSession.setActionHandlers({
      onPlay: () => this.play(),
      onPause: () => this.pause(),
      onPrevious: () => this.previous(),
      onNext: () => this.next(),
      onSeekTo: (s) => this.seek(s),
      onSeekBackward: (offset) => this.seek(Math.max(0, this.currentTime - offset)),
      onSeekForward: (offset) => this.seek(Math.min(this.duration, this.currentTime + offset)),
    });

    this.scheduler = new Scheduler(this.audioGraph, {
      onNextTrackReady: (track, sources) => {
        if (sources.selected) {
          this.resolvedQualities[track.id] = sources.selected;
        }
      },
      onTrackTransition: (track, sourcesData, newIndex) => {
        if (sourcesData.selected) {
          this.resolvedQualities[track.id] = sourcesData.selected;
        }
        this.recordCurrentListen(true);
        this.applyTrackTransition(track, sourcesData, newIndex);
      },
      onEndOfQueue: () => {
        this.recordCurrentListen(true);
        this.status = 'paused';
        this.mediaSession.setPlaybackState('paused');
      },
      onPrefetchDone: () => {
        void import('$lib/queries').then(({ queryClient }) => {
          queryClient.invalidateQueries({ queryKey: ['album'] });
          queryClient.invalidateQueries({ queryKey: ['playlist'] });
        });
      },
    });
  }

  private readStoredSettings() {
    if (typeof localStorage === 'undefined') return;

    const savedVol = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (savedVol != null) {
      const v = Number.parseFloat(savedVol);
      if (!Number.isNaN(v)) this.volume = Math.max(0, Math.min(1, v));
    }

    const savedQual = localStorage.getItem(QUALITY_STORAGE_KEY) as QualityTier | null;
    if (savedQual && ['max', 'hires', 'lossless', 'high', 'standard'].includes(savedQual)) {
      this.quality = savedQual;
    }

    const savedCrossfade = localStorage.getItem(CROSSFADE_STORAGE_KEY);
    if (savedCrossfade != null) {
      const c = Number.parseFloat(savedCrossfade);
      if (!Number.isNaN(c)) this.crossfadeSeconds = Math.max(0, Math.min(12, c));
    }

    const savedNorm = localStorage.getItem(NORMALIZATION_STORAGE_KEY);
    if (savedNorm != null) {
      this.normalizationEnabled = savedNorm === 'true';
    }

    try {
      const savedTrackJson = localStorage.getItem(SESSION_TRACK_KEY);
      if (savedTrackJson) {
        const track = JSON.parse(savedTrackJson) as Track;
        if (track && track.id && track.title) {
          this.currentTrack = track;
          this.duration = (track.durationMs ?? 0) / 1000;
          this.status = 'paused';
          const savedQueueJson = localStorage.getItem(SESSION_QUEUE_KEY);
          if (savedQueueJson) {
            const q = JSON.parse(savedQueueJson) as Track[];
            if (Array.isArray(q) && q.length > 0) {
              this.queue = q;
              this.unshuffledQueue = [...q];
            }
          }
          const savedIdx = localStorage.getItem(SESSION_QUEUE_INDEX_KEY);
          if (savedIdx != null) {
            const idx = Number.parseInt(savedIdx, 10);
            if (!Number.isNaN(idx)) this.queueIndex = idx;
          }
          this.mediaSession.setMetadata(track);
          this.mediaSession.setPlaybackState('paused');
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  private saveSession() {
    if (typeof localStorage === 'undefined') return;
    try {
      if (this.currentTrack) {
        localStorage.setItem(SESSION_TRACK_KEY, JSON.stringify(this.currentTrack));
        localStorage.setItem(SESSION_QUEUE_KEY, JSON.stringify(this.queue.slice(0, 100)));
        localStorage.setItem(SESSION_QUEUE_INDEX_KEY, String(this.queueIndex));
      }
    } catch {
      // ignore storage errors
    }
  }

  private applyTrackTransition(track: Track, sourcesData: ResolvedSources, newIndex: number) {
    this.currentTrack = track;
    this.selectedSource = sourcesData.selected;
    this.alternatives = sourcesData.alternatives ?? [];
    this.currentPlayUrl = sourcesData.play.url;
    this.currentExpiresAt = sourcesData.play.expiresAt;
    this.queueIndex = newIndex;
    this.currentTime = 0;
    this.buffered = 0;
    this.duration = (track.durationMs ?? 0) / 1000;
    this.status = 'playing';
    this.retryCount = 0;

    this.listenStartTime = Date.now();
    this.listenStartIso = formatIsoWithOffset();

    this.mediaSession.setMetadata(track);
    this.mediaSession.setPlaybackState('playing');

    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat, this.quality);
    this.scheduler.queueChanged(this.queue, this.queueIndex, this.quality);
    this.saveSession();
  }

  private async handleTrackEnded() {
    this.recordCurrentListen(true);
    const handled = await this.scheduler.handleTrackEnded(this.queue, this.queueIndex, this.repeat);
    if (!handled) {
      const nextIdx = this.scheduler.getNextIndex(this.queueIndex, this.queue.length, this.repeat);
      if (nextIdx >= 0 && nextIdx < this.queue.length) {
        await this.playIndex(nextIdx);
      } else {
        this.status = 'paused';
        this.mediaSession.setPlaybackState('paused');
      }
    }
  }

  private async handleAudioError(err: MediaError | null) {
    console.warn('[PlayerEngine] Media error caught:', err);
    if (!this.currentTrack) return;

    if (this.retryCount === 0) {
      this.retryCount++;
      const savedPos = this.currentTime;
      console.info(
        `[PlayerEngine] Refreshing token for "${this.currentTrack.title}" at position ${savedPos}s`,
      );

      try {
        const { data, error } = await api.GET('/v1/tracks/{id}/sources', {
          params: {
            path: { id: this.currentTrack.id },
            query: { quality: this.quality, refresh: 'true' },
          },
        });

        if (error || !data?.play?.url) {
          throw error ?? new Error('No play URL returned on refresh');
        }

        this.selectedSource = data.selected;
        this.currentPlayUrl = data.play.url;
        this.currentExpiresAt = data.play.expiresAt;
        const gainDb = this.normalizationEnabled ? data.play.normalization?.gainDb : null;
        await this.audioGraph.loadAndPlay(data.play.url, gainDb, savedPos);
        return;
      } catch (refreshErr) {
        console.warn('[PlayerEngine] Recovery with refresh token failed:', refreshErr);
      }
    }

    toast.push(`Couldn't play "${this.currentTrack.title}", skipped`, { tone: 'danger' });
    this.next();
  }

  private async checkProactiveExpiry() {
    if (
      !this.currentExpiresAt ||
      !this.currentTrack ||
      this.isRefreshingToken ||
      !isTokenExpiringSoon(this.currentExpiresAt)
    ) {
      return;
    }

    this.isRefreshingToken = true;
    try {
      const { data } = await api.GET('/v1/tracks/{id}/sources', {
        params: {
          path: { id: this.currentTrack.id },
          query: { quality: this.quality, refresh: 'true' },
        },
      });

      if (data?.play) {
        this.currentExpiresAt = data.play.expiresAt;
        this.currentPlayUrl = data.play.url;
        this.selectedSource = data.selected;
      }
    } catch (e) {
      console.warn('[PlayerEngine] Proactive token refresh failed:', e);
    } finally {
      this.isRefreshingToken = false;
    }
  }

  private recordCurrentListen(completed = false) {
    if (!this.currentTrack || !this.listenStartTime) return;
    const msPlayed = Date.now() - this.listenStartTime;
    if (msPlayed > 1000) {
      this.historyTracker.record({
        trackId: this.currentTrack.id,
        startedAt: this.listenStartIso,
        msPlayed,
        completed,
        context: this.listenContext,
        sourceProvider: this.selectedSource?.provider,
      });
    }
    this.listenStartTime = null;
  }

  // --- Public Controls ---

  togglePlay() {
    if (this.status === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  async play() {
    if (!this.currentTrack) return;
    this.status = 'playing';
    this.mediaSession.setPlaybackState('playing');
    if (this.currentPlayUrl && this.audioGraph.activeElement?.src) {
      await this.audioGraph.play();
    } else if (!this.currentPlayUrl) {
      await this.playTrack(this.currentTrack);
    }
  }

  pause() {
    this.recordCurrentListen(false);
    this.status = 'paused';
    this.audioGraph.pause();
    this.mediaSession.setPlaybackState('paused');
  }

  async playTrack(track: Track, newQueue?: Track[], context?: { type: string; id: string }) {
    this.recordCurrentListen(false);
    this.listenContext = context;
    this.retryCount = 0;

    if (newQueue && newQueue.length > 0) {
      this.unshuffledQueue = [...newQueue];
      if (this.shuffle) {
        const others = newQueue.filter((t) => t.id !== track.id);
        this.queue = [track, ...shuffleArray(others)];
        this.queueIndex = 0;
      } else {
        this.queue = [...newQueue];
        const idx = this.queue.findIndex((t) => t.id === track.id);
        this.queueIndex = idx >= 0 ? idx : 0;
      }
    }

    this.currentTrack = track;
    this.currentTime = 0;
    this.buffered = 0;
    this.duration = (track.durationMs ?? 0) / 1000;
    this.status = 'loading';
    this.scheduler.clearPreload();

    try {
      let { data, error } = await api.GET('/v1/tracks/{id}/sources', {
        params: {
          path: { id: track.id },
          query: { quality: this.quality },
        },
      });

      // If the engine returned a standard fallback source (e.g. YouTube materialize) while higher quality is requested,
      // refresh once to check if a higher-tier provider (e.g. JioSaavn 320k) has since become available
      if (
        data?.selected &&
        data.selected.provider === 'youtube' &&
        (this.quality === 'max' || this.quality === 'high' || this.quality === 'lossless')
      ) {
        try {
          const refreshed = await api.GET('/v1/tracks/{id}/sources', {
            params: {
              path: { id: track.id },
              query: { quality: this.quality, refresh: 'true' },
            },
          });
          if (refreshed.data?.selected && refreshed.data.selected.provider !== 'youtube') {
            data = refreshed.data;
          }
        } catch {
          // ignore and proceed with existing data
        }
      }

      if (error || !data || !data.play?.url) {
        throw error ?? new Error('No playable source found');
      }

      this.selectedSource = data.selected;
      this.resolvedQualities[track.id] = data.selected;
      this.alternatives = data.alternatives ?? [];
      this.currentPlayUrl = data.play.url;
      this.currentExpiresAt = data.play.expiresAt;

      const gainDb = this.normalizationEnabled ? data.play.normalization?.gainDb : null;
      await this.audioGraph.loadAndPlay(data.play.url, gainDb, 0);

      this.status = 'playing';
      this.listenStartTime = Date.now();
      this.listenStartIso = formatIsoWithOffset();

      this.mediaSession.setMetadata(track);
      this.mediaSession.setPlaybackState('playing');

      this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat, this.quality);
      this.scheduler.queueChanged(this.queue, this.queueIndex, this.quality);
      this.saveSession();
    } catch (err) {
      console.warn('[PlayerEngine] playTrack resolution error:', err);
      toast.push(`Couldn't play "${track.title}"`, { tone: 'danger' });
      this.status = 'paused';
    }
  }

  async playIndex(index: number) {
    if (index >= 0 && index < this.queue.length) {
      const track = this.queue[index];
      if (track) {
        this.queueIndex = index;
        await this.playTrack(track);
      }
    }
  }

  async next() {
    if (this.repeat === 'one') {
      this.seek(0);
      await this.play();
      return;
    }

    const nextIdx = this.scheduler.getNextIndex(this.queueIndex, this.queue.length, this.repeat);
    if (nextIdx >= 0 && nextIdx < this.queue.length) {
      const preloaded = this.scheduler.preloadedTrackInfo;
      if (preloaded && preloaded.index === nextIdx) {
        await this.audioGraph.swapToPreloaded();
        this.applyTrackTransition(preloaded.track, preloaded.sources, nextIdx);
      } else {
        await this.playIndex(nextIdx);
      }
    } else {
      this.pause();
    }
  }

  async previous() {
    if (this.currentTime > 3) {
      this.seek(0);
      return;
    }

    if (this.queueIndex > 0) {
      await this.playIndex(this.queueIndex - 1);
    } else if (this.repeat === 'all' && this.queue.length > 0) {
      await this.playIndex(this.queue.length - 1);
    } else {
      this.seek(0);
    }
  }

  get hasNext(): boolean {
    if (this.queue.length <= 1) return false;
    if (this.repeat !== 'off') return true;
    return this.queueIndex < this.queue.length - 1;
  }

  get hasPrevious(): boolean {
    if (this.currentTime > 3) return true;
    if (this.queue.length <= 1) return false;
    if (this.repeat !== 'off') return true;
    return this.queueIndex > 0;
  }

  seek(seconds: number) {
    const target = Math.max(0, Math.min(seconds, this.duration));
    this.currentTime = target;
    this.audioGraph.seek(target);
    this.mediaSession.setPositionState(this.duration, target);
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.volume > 0 && this.muted) {
      this.muted = false;
    }
    const gainDb = this.normalizationEnabled ? this.selectedSource?.normalization?.gainDb : null;
    this.audioGraph.setVolume(this.muted ? 0 : this.volume, gainDb);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(this.volume));
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    const gainDb = this.normalizationEnabled ? this.selectedSource?.normalization?.gainDb : null;
    this.audioGraph.setVolume(this.muted ? 0 : this.volume, gainDb);
  }

  toggleRepeat() {
    if (this.repeat === 'off') this.repeat = 'all';
    else if (this.repeat === 'all') this.repeat = 'one';
    else this.repeat = 'off';
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat, this.quality);
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    if (this.shuffle) {
      this.unshuffledQueue = [...this.queue];
      if (this.currentTrack) {
        const others = this.queue.filter((t) => t.id !== this.currentTrack!.id);
        this.queue = [this.currentTrack, ...shuffleArray(others)];
        this.queueIndex = 0;
      } else {
        this.queue = shuffleArray(this.queue);
        this.queueIndex = 0;
      }
    } else {
      this.queue = [...this.unshuffledQueue];
      if (this.currentTrack) {
        const idx = this.queue.findIndex((t) => t.id === this.currentTrack!.id);
        this.queueIndex = idx >= 0 ? idx : 0;
      }
    }
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat, this.quality);
    this.scheduler.queueChanged(this.queue, this.queueIndex, this.quality);
  }

  setQuality(quality: QualityTier) {
    this.quality = quality;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(QUALITY_STORAGE_KEY, quality);
    }
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat, this.quality);
    this.scheduler.queueChanged(this.queue, this.queueIndex, this.quality);
  }

  setCrossfade(seconds: number) {
    this.crossfadeSeconds = Math.max(0, Math.min(12, seconds));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CROSSFADE_STORAGE_KEY, String(this.crossfadeSeconds));
    }
  }

  setNormalization(enabled: boolean) {
    this.normalizationEnabled = enabled;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(NORMALIZATION_STORAGE_KEY, String(enabled));
    }
    const gainDb = this.normalizationEnabled ? this.selectedSource?.normalization?.gainDb : null;
    this.audioGraph.setVolume(this.muted ? 0 : this.volume, gainDb);
  }

  toggleRightPanel() {
    this.rightPanelOpen = !this.rightPanelOpen;
  }

  radioSeed = $state<string | null>(null);

  async startRadio(
    seedType: 'artist' | 'album' | 'track' | 'playlist',
    seedId: string,
    initialTrack?: Track,
  ) {
    const seed = `${seedType}:${seedId}`;
    try {
      const { fetchRadioTracks } = await import('$lib/queries');
      const radioTracks = await fetchRadioTracks(seed, 25);
      if (radioTracks.length > 0) {
        this.radioSeed = seed;
        const first = initialTrack ?? radioTracks[0]!;
        await this.playTrack(first, radioTracks, { type: 'radio', id: seed });
        toast.push(`Playing radio for ${seedType}`);
      } else {
        toast.push('Could not find radio tracks for this selection', { tone: 'danger' });
      }
    } catch (err) {
      console.warn('[PlayerEngine] startRadio error:', err);
      toast.push('Could not start radio', { tone: 'danger' });
    }
  }

  addToQueue(track: Track) {
    this.queue = [...this.queue, track];
    this.unshuffledQueue = [...this.unshuffledQueue, track];
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat, this.quality);
    this.scheduler.queueChanged(this.queue, this.queueIndex, this.quality);
    toast.push(`Added "${track.title}" to queue`);
  }

  playNext(track: Track) {
    const nextIdx = this.queueIndex + 1;
    const newQueue = [...this.queue];
    newQueue.splice(nextIdx, 0, track);
    this.queue = newQueue;
    this.unshuffledQueue.push(track);
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat, this.quality);
    this.scheduler.queueChanged(this.queue, this.queueIndex, this.quality);
    toast.push(`Will play "${track.title}" next`);
  }

  removeFromQueue(index: number) {
    if (index < 0 || index >= this.queue.length || index === this.queueIndex) return;
    const track = this.queue[index];
    const newQueue = this.queue.filter((_, i) => i !== index);
    if (index < this.queueIndex) {
      this.queueIndex--;
    }
    this.queue = newQueue;
    this.unshuffledQueue = this.unshuffledQueue.filter((t) => t.id !== track?.id);
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat, this.quality);
    this.scheduler.queueChanged(this.queue, this.queueIndex, this.quality);
  }

  moveInQueue(fromIndex: number, toIndex: number) {
    if (
      fromIndex < 0 ||
      fromIndex >= this.queue.length ||
      toIndex < 0 ||
      toIndex >= this.queue.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const newQueue = [...this.queue];
    const [moved] = newQueue.splice(fromIndex, 1);
    if (!moved) return;
    newQueue.splice(toIndex, 0, moved);

    // Adjust current playing index if it shifted
    if (this.queueIndex === fromIndex) {
      this.queueIndex = toIndex;
    } else if (fromIndex < this.queueIndex && toIndex >= this.queueIndex) {
      this.queueIndex--;
    } else if (fromIndex > this.queueIndex && toIndex <= this.queueIndex) {
      this.queueIndex++;
    }

    this.queue = newQueue;
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat, this.quality);
    this.scheduler.queueChanged(this.queue, this.queueIndex, this.quality);
  }

  clearQueue() {
    if (this.currentTrack) {
      this.queue = this.queue.slice(0, this.queueIndex + 1);
      this.unshuffledQueue = this.unshuffledQueue.filter((t) => this.queue.some((q) => q.id === t.id));
    } else {
      this.queue = [];
      this.unshuffledQueue = [];
      this.queueIndex = 0;
    }
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat, this.quality);
    this.scheduler.queueChanged(this.queue, this.queueIndex, this.quality);
    toast.push('Cleared upcoming queue');
  }

  setQueue(newQueue: Track[], index = 0) {
    if (!newQueue || newQueue.length === 0) return;
    this.unshuffledQueue = [...newQueue];
    this.queue = [...newQueue];
    this.queueIndex = Math.max(0, Math.min(newQueue.length - 1, index));
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat, this.quality);
    this.scheduler.queueChanged(this.queue, this.queueIndex, this.quality);
    this.saveSession();
  }
}

export const player = new PlayerEngine();
