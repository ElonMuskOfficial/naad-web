import { api } from '$lib/api/client';
import { toast } from '$lib/toast.svelte';
import type { Audio, Track } from '$lib/types';
import { AudioGraph } from './audio-graph';
import { HistoryTracker } from './history';
import { formatIsoWithOffset, shuffleArray } from './math';
import { MediaSessionController } from './media-session';
import { Scheduler } from './scheduler';
import { migrateSession } from './session-version';

export const VOLUME_STORAGE_KEY = 'naad:volume';
export const CROSSFADE_STORAGE_KEY = 'naad:crossfade';
export const SESSION_TRACK_KEY = 'naad:current_track';
export const SESSION_QUEUE_KEY = 'naad:queue';
export const SESSION_QUEUE_INDEX_KEY = 'naad:queue_index';

export class PlayerEngine {
  // Playback state (Svelte 5 runes)
  currentTrack = $state<Track | null>(null);
  currentAudio = $state<Audio | null>(null);
  currentPlayUrl = $state<string | null>(null);
  status = $state<'idle' | 'playing' | 'paused' | 'loading'>('idle');
  currentTime = $state<number>(0);
  duration = $state<number>(0);
  buffered = $state<number>(0);
  volume = $state<number>(0.85);
  muted = $state<boolean>(false);
  repeat = $state<'off' | 'all' | 'one'>('off');
  shuffle = $state<boolean>(false);
  crossfadeSeconds = $state<number>(0);
  queue = $state<Track[]>([]);
  queueIndex = $state<number>(0);
  measuredGapMs = $state<number | null>(null);

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
      },
      onDurationChange: (dur) => {
        if (Number.isFinite(dur) && dur > 0) {
          if (this.currentTrack?.durationMs && dur < this.currentTrack.durationMs / 1000 - 2) {
            return;
          }
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
      onTrackTransition: (track, audio, newIndex) => {
        this.recordCurrentListen(true);
        this.applyTrackTransition(track, audio, newIndex);
      },
      onEndOfQueue: () => {
        this.recordCurrentListen(true);
        this.status = 'paused';
        this.mediaSession.setPlaybackState('paused');
      },
    });
  }

  private readStoredSettings() {
    if (typeof localStorage === 'undefined') return;

    // A session saved under another engine holds ids that do not exist here: drop it once.
    migrateSession(localStorage, [SESSION_TRACK_KEY, SESSION_QUEUE_KEY, SESSION_QUEUE_INDEX_KEY]);

    const savedVol = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (savedVol != null) {
      const v = Number.parseFloat(savedVol);
      if (!Number.isNaN(v)) this.volume = Math.max(0, Math.min(1, v));
    }

    const savedCrossfade = localStorage.getItem(CROSSFADE_STORAGE_KEY);
    if (savedCrossfade != null) {
      const c = Number.parseFloat(savedCrossfade);
      if (!Number.isNaN(c)) this.crossfadeSeconds = Math.max(0, Math.min(12, c));
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

  private applyTrackTransition(track: Track, audio: Audio, newIndex: number) {
    this.currentTrack = track;
    this.currentAudio = audio;
    this.currentPlayUrl = audio.url;
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

    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat);
    this.scheduler.queueChanged(this.queue, this.queueIndex);
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
        `[PlayerEngine] Re-resolving audio for "${this.currentTrack.title}" at position ${savedPos}s`,
      );

      try {
        const { data, error } = await api.GET('/v1/tracks/{id}/audio', {
          params: {
            path: { id: this.currentTrack.id },
            query: { refresh: true },
          },
        });

        if (error || !data?.url) {
          throw error ?? new Error('No audio URL returned on refresh');
        }

        this.currentAudio = data;
        this.currentPlayUrl = data.url;
        await this.audioGraph.loadAndPlay(data.url, savedPos);
        return;
      } catch (refreshErr) {
        console.warn('[PlayerEngine] Recovery with a fresh audio lookup failed:', refreshErr);
      }
    }

    toast.push(`Couldn't play "${this.currentTrack.title}", skipped`, { tone: 'danger' });
    this.next();
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
      const { data, error } = await api.GET('/v1/tracks/{id}/audio', {
        params: {
          path: { id: track.id },
        },
      });

      if (error || !data?.url) {
        throw error ?? new Error('No playable audio found');
      }

      this.currentAudio = data;
      this.currentPlayUrl = data.url;
      await this.audioGraph.loadAndPlay(data.url, 0);

      this.status = 'playing';
      this.listenStartTime = Date.now();
      this.listenStartIso = formatIsoWithOffset();

      this.mediaSession.setMetadata(track);
      this.mediaSession.setPlaybackState('playing');

      this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat);
      this.scheduler.queueChanged(this.queue, this.queueIndex);
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
        // playTrack() records what it leaves; this path swaps tracks without it, so the skipped listen was lost.
        this.recordCurrentListen(false);
        await this.audioGraph.swapToPreloaded();
        this.applyTrackTransition(preloaded.track, preloaded.audio, nextIdx);
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

  commitSeek(seconds: number) {
    this.seek(seconds);
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.volume > 0 && this.muted) {
      this.muted = false;
    }
    this.audioGraph.setVolume(this.muted ? 0 : this.volume);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(this.volume));
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.audioGraph.setVolume(this.muted ? 0 : this.volume);
  }

  toggleRepeat() {
    if (this.repeat === 'off') this.repeat = 'all';
    else if (this.repeat === 'all') this.repeat = 'one';
    else this.repeat = 'off';
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat);
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
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat);
    this.scheduler.queueChanged(this.queue, this.queueIndex);
  }

  async resolveAudio(trackId?: string): Promise<Audio | null> {
    const targetId = trackId ?? this.currentTrack?.id;
    if (!targetId) return null;
    try {
      const { data, error } = await api.GET('/v1/tracks/{id}/audio', {
        params: {
          path: { id: targetId },
        },
      });
      if (error || !data) return null;
      if (this.currentTrack && this.currentTrack.id === targetId) {
        this.currentAudio = data;
        this.saveSession();
      }
      return data;
    } catch {
      return null;
    }
  }

  setCrossfade(seconds: number) {
    this.crossfadeSeconds = Math.max(0, Math.min(12, seconds));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CROSSFADE_STORAGE_KEY, String(this.crossfadeSeconds));
    }
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
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat);
    this.scheduler.queueChanged(this.queue, this.queueIndex);
    toast.push(`Added "${track.title}" to queue`);
  }

  playNext(track: Track) {
    const nextIdx = this.queueIndex + 1;
    const newQueue = [...this.queue];
    newQueue.splice(nextIdx, 0, track);
    this.queue = newQueue;
    this.unshuffledQueue.push(track);
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat);
    this.scheduler.queueChanged(this.queue, this.queueIndex);
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
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat);
    this.scheduler.queueChanged(this.queue, this.queueIndex);
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
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat);
    this.scheduler.queueChanged(this.queue, this.queueIndex);
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
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat);
    this.scheduler.queueChanged(this.queue, this.queueIndex);
    toast.push('Cleared upcoming queue');
  }

  setQueue(newQueue: Track[], index = 0) {
    if (!newQueue || newQueue.length === 0) return;
    this.unshuffledQueue = [...newQueue];
    this.queue = [...newQueue];
    this.queueIndex = Math.max(0, Math.min(newQueue.length - 1, index));
    this.scheduler.prepareNextTrack(this.queue, this.queueIndex, this.repeat);
    this.scheduler.queueChanged(this.queue, this.queueIndex);
    this.saveSession();
  }
}

export const player = new PlayerEngine();
