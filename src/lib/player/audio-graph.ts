import { calculateEffectiveVolume } from './math';

export interface AudioGraphCallbacks {
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onBuffered?: (buffered: number) => void;
  onEnded?: () => void;
  onError?: (err: MediaError | null) => void;
  onPlaying?: () => void;
  onPause?: () => void;
  onWaiting?: () => void;
  onGapMeasured?: (gapMs: number) => void;
}

export class AudioGraph {
  private elementA: HTMLAudioElement | null = null;
  private elementB: HTMLAudioElement | null = null;
  private activeSlot: 'A' | 'B' = 'A';
  private userVolume = 0.85;
  private currentGainDb: number | null = null;
  private nextGainDb: number | null = null;
  private callbacks: AudioGraphCallbacks;
  private endedTimestamp = 0;
  private isCrossfading = false;
  private crossfadeRafId: number | null = null;

  constructor(callbacks: AudioGraphCallbacks = {}) {
    this.callbacks = callbacks;
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      this.elementA = new Audio();
      this.elementB = new Audio();
      this.setupElement(this.elementA, 'A');
      this.setupElement(this.elementB, 'B');
    }
  }

  private setupElement(el: HTMLAudioElement, slot: 'A' | 'B') {
    el.preload = 'auto';

    el.addEventListener('timeupdate', () => {
      if (this.activeSlot === slot && !this.isCrossfading) {
        this.callbacks.onTimeUpdate?.(el.currentTime);
      }
    });

    el.addEventListener('durationchange', () => {
      if (this.activeSlot === slot && Number.isFinite(el.duration)) {
        this.callbacks.onDurationChange?.(el.duration);
      }
    });

    el.addEventListener('progress', () => {
      if (this.activeSlot === slot && el.buffered.length > 0) {
        const bufferedEnd = el.buffered.end(el.buffered.length - 1);
        this.callbacks.onBuffered?.(bufferedEnd);
      }
    });

    el.addEventListener('playing', () => {
      if (this.activeSlot === slot) {
        if (this.endedTimestamp > 0) {
          const gapMs = Math.round(performance.now() - this.endedTimestamp);
          this.endedTimestamp = 0;
          this.callbacks.onGapMeasured?.(gapMs);
          console.debug(`[AudioGraph] Gapless handoff measured gap: ${gapMs} ms`);
        }
        this.callbacks.onPlaying?.();
      }
    });

    el.addEventListener('pause', () => {
      if (this.activeSlot === slot && !this.isCrossfading) {
        this.callbacks.onPause?.();
      }
    });

    el.addEventListener('waiting', () => {
      if (this.activeSlot === slot) {
        this.callbacks.onWaiting?.();
      }
    });

    el.addEventListener('ended', () => {
      if (this.activeSlot === slot) {
        this.endedTimestamp = performance.now();
        this.callbacks.onEnded?.();
      }
    });

    el.addEventListener('error', () => {
      if (this.activeSlot === slot) {
        this.callbacks.onError?.(el.error);
      }
    });
  }

  get activeElement(): HTMLAudioElement | null {
    return this.activeSlot === 'A' ? this.elementA : this.elementB;
  }

  get idleElement(): HTMLAudioElement | null {
    return this.activeSlot === 'A' ? this.elementB : this.elementA;
  }

  /**
   * Loads a stream URL into the active element and begins playback.
   */
  async loadAndPlay(url: string, gainDb?: number | null, startPosition = 0): Promise<void> {
    const el = this.activeElement;
    if (!el) return;

    this.cancelCrossfade();
    this.currentGainDb = gainDb ?? null;
    el.src = url;
    el.volume = calculateEffectiveVolume(this.userVolume, this.currentGainDb);
    if (startPosition > 0) {
      el.currentTime = startPosition;
    }

    try {
      await el.play();
    } catch (err) {
      // Browser autoplay policy or abort
      console.warn('[AudioGraph] Play rejected:', err);
    }
  }

  /**
   * Preloads the next track into the idle element.
   */
  preload(url: string, gainDb?: number | null) {
    const idle = this.idleElement;
    if (!idle) return;

    this.nextGainDb = gainDb ?? null;
    idle.src = url;
    idle.volume = calculateEffectiveVolume(this.userVolume, this.nextGainDb);
    idle.preload = 'auto';
    idle.load();
  }

  /**
   * Swaps immediately to the preloaded element for gapless playback.
   */
  async swapToPreloaded(): Promise<void> {
    const prevActive = this.activeElement;
    const nextActive = this.idleElement;

    if (!nextActive?.src) return;

    this.activeSlot = this.activeSlot === 'A' ? 'B' : 'A';
    this.currentGainDb = this.nextGainDb;
    this.nextGainDb = null;

    if (prevActive) {
      prevActive.pause();
      prevActive.removeAttribute('src');
      prevActive.load();
    }

    nextActive.volume = calculateEffectiveVolume(this.userVolume, this.currentGainDb);

    try {
      await nextActive.play();
    } catch (err) {
      console.warn('[AudioGraph] Swap play error:', err);
    }
  }

  /**
   * Performs an audio crossfade transition over crossfadeSeconds using requestAnimationFrame.
   */
  startCrossfade(crossfadeSeconds: number, onComplete: () => void) {
    const outgoing = this.activeElement;
    const incoming = this.idleElement;

    if (!outgoing || !incoming?.src || crossfadeSeconds <= 0) {
      this.swapToPreloaded().then(onComplete);
      return;
    }

    this.isCrossfading = true;
    const targetOutVol = calculateEffectiveVolume(this.userVolume, this.currentGainDb);
    const targetInVol = calculateEffectiveVolume(this.userVolume, this.nextGainDb);

    incoming.volume = 0;
    incoming.play().catch(() => {});

    const startTime = performance.now();
    const durationMs = crossfadeSeconds * 1000;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      outgoing.volume = Math.max(0, targetOutVol * (1 - progress));
      incoming.volume = Math.min(1, targetInVol * progress);

      if (progress < 1) {
        this.crossfadeRafId = requestAnimationFrame(step);
      } else {
        this.isCrossfading = false;
        this.activeSlot = this.activeSlot === 'A' ? 'B' : 'A';
        this.currentGainDb = this.nextGainDb;
        this.nextGainDb = null;
        outgoing.pause();
        outgoing.removeAttribute('src');
        outgoing.load();
        onComplete();
      }
    };

    this.crossfadeRafId = requestAnimationFrame(step);
  }

  private cancelCrossfade() {
    if (this.crossfadeRafId != null) {
      cancelAnimationFrame(this.crossfadeRafId);
      this.crossfadeRafId = null;
    }
    this.isCrossfading = false;
  }

  play(): Promise<void> | void {
    return this.activeElement?.play();
  }

  pause() {
    this.activeElement?.pause();
  }

  seek(seconds: number) {
    if (this.activeElement && Number.isFinite(seconds)) {
      this.activeElement.currentTime = seconds;
    }
  }

  setVolume(volume: number, gainDb?: number | null) {
    this.userVolume = Math.max(0, Math.min(1, volume));
    if (gainDb !== undefined) {
      this.currentGainDb = gainDb;
    }
    if (this.activeElement) {
      this.activeElement.volume = calculateEffectiveVolume(this.userVolume, this.currentGainDb);
    }
  }

  destroy() {
    this.cancelCrossfade();
    if (this.elementA) {
      this.elementA.pause();
      this.elementA.removeAttribute('src');
      this.elementA = null;
    }
    if (this.elementB) {
      this.elementB.pause();
      this.elementB.removeAttribute('src');
      this.elementB = null;
    }
  }
}
