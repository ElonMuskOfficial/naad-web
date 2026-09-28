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

/** One <audio> element plus the GainNode that controls its volume, once routed through the AudioContext. */
interface Slot {
  element: HTMLAudioElement;
  gain: GainNode | null;
}

export class AudioGraph {
  private slotA: Slot | null = null;
  private slotB: Slot | null = null;
  private activeSlot: 'A' | 'B' = 'A';
  private audioContext: AudioContext | null = null;
  private userVolume = 0.85;
  private callbacks: AudioGraphCallbacks;
  private endedTimestamp = 0;
  private isCrossfading = false;
  private crossfadeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private crossfadeOnComplete: (() => void) | null = null;
  private onVisibilityChange: (() => void) | null = null;

  constructor(callbacks: AudioGraphCallbacks = {}) {
    this.callbacks = callbacks;
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      const globalWindow = window as unknown as { __naad_audio_graph__?: AudioGraph };
      if (globalWindow.__naad_audio_graph__) {
        try {
          globalWindow.__naad_audio_graph__.destroy();
        } catch {}
      }
      globalWindow.__naad_audio_graph__ = this;

      // Tells the OS this page plays music, not e.g. a notification blip — on iOS 17+ this is what makes
      // the WebKit fix for keeping AudioContext running through backgrounding actually apply (confirmed
      // fixed in WebKit main 2024-03-01, live in iOS 17.5+). Feature-detected; a no-op where unsupported.
      if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
        try {
          (navigator as unknown as { audioSession: { type: string } }).audioSession.type = 'playback';
        } catch {}
      }

      this.buildElements();
      this.setupAudioContext();

      if (typeof document !== 'undefined') {
        // A crossfade's completion bookkeeping (swap the active slot, tear down the outgoing element,
        // call onComplete) is still driven from JS — but now only as bookkeeping. The actual fade is a
        // GainNode.linearRampToValueAtTime schedule handed to the audio rendering thread up front (see
        // startCrossfade), which keeps running sample-accurately regardless of whether the page is
        // visible, unlike the old requestAnimationFrame-stepped version. Still, the bookkeeping wants to
        // run promptly rather than however late a background setTimeout gets coalesced to, so finish
        // immediately on hide (and see the ended-during-crossfade handler below for the same reasoning
        // while the page stays visible).
        this.onVisibilityChange = () => {
          if (document.hidden && this.isCrossfading) {
            this.finishCrossfade();
          }
        };
        document.addEventListener('visibilitychange', this.onVisibilityChange);
      }

      if (import.meta.hot) {
        import.meta.hot.dispose(() => {
          this.destroy();
        });
      }
    }
  }

  /** Creates elementA/elementB and wires their DOM event listeners — split out from the constructor so
   *  rebuildAfterClose() below can rebuild just the elements without duplicating this. */
  private buildElements() {
    const elementA = new Audio();
    const elementB = new Audio();
    // Set before any src is ever assigned: JioSaavn's audio CDN sends a real Access-Control-Allow-Origin
    // (confirmed live, not assumed), so anonymous CORS is enough for createMediaElementSource below to
    // work everywhere, including Safari/WebKit, which is historically the stricter one here.
    elementA.crossOrigin = 'anonymous';
    elementB.crossOrigin = 'anonymous';
    this.slotA = { element: elementA, gain: null };
    this.slotB = { element: elementB, gain: null };
    this.setupElement(elementA, 'A');
    this.setupElement(elementB, 'B');
  }

  /** Routes both elements through an AudioContext (element -> GainNode -> destination) so volume control,
   *  crossfade included, is AudioParam automation on the audio thread rather than JS setting `.volume`
   *  every frame. Best-effort: if this throws (an old browser, a policy blocking AudioContext, ...), gain
   *  stays null and setGain() below falls back to plain `.volume` — degraded, but still functional. */
  private setupAudioContext() {
    if (typeof AudioContext === 'undefined' || !this.slotA || !this.slotB) return;
    try {
      const ctx = new AudioContext();
      this.audioContext = ctx;
      for (const slot of [this.slotA, this.slotB]) {
        const source = ctx.createMediaElementSource(slot.element);
        const gain = ctx.createGain();
        gain.gain.value = this.userVolume;
        source.connect(gain).connect(ctx.destination);
        slot.gain = gain;
        // Volume now lives entirely on the GainNode; leaving the element's own volume at anything but 1
        // would double-attenuate.
        slot.element.volume = 1;
      }
      // iOS moves the context to a non-standard 'interrupted' state (not 'suspended') for exactly this —
      // the screen locking, a call coming in — and won't recover on its own; resumeAudioContext() below
      // handles the reactive path (next play()/loadAndPlay()/etc. call), but a track already mid-playback
      // when the interruption ends has no such call coming, so also resume proactively as soon as the
      // context reports it's able to.
      ctx.addEventListener('statechange', () => {
        if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
          ctx.resume().catch(() => {});
        } else if (ctx.state === 'closed' && this.audioContext === ctx) {
          // Only if ctx is still the current context — rebuildAfterClose() replaces it with a new one,
          // whose own 'closed' listener (once actually needed) is this same handler on that new instance.
          this.rebuildAfterClose();
        }
      });
    } catch (err) {
      console.warn('[AudioGraph] Web Audio setup failed, falling back to element volume:', err);
      this.audioContext = null;
    }
  }

  /** Rebuilds the entire graph — fresh AudioContext, fresh <audio> elements — for the one state resume()
   *  can't fix: 'closed'. Rare in practice (a locked screen produces 'interrupted' or 'suspended', not
   *  this — confirmed via WebKit's own bug tracker, not assumed), but not impossible under OS memory
   *  pressure. A MediaElementAudioSourceNode can only ever be created once per <audio> element for its
   *  whole lifetime, even across different AudioContexts, so recovering needs new elements too, not just a
   *  new context — carrying over whichever element was actually active's src/position/playing state so
   *  the rebuild itself is inaudible. */
  private rebuildAfterClose() {
    if (!this.slotA || !this.slotB) return;
    const prevActiveSlot = this.activeSlot;
    const prevActive = this.active;
    const wasPlaying = !!prevActive && !prevActive.element.paused;
    const activeSrc = prevActive?.element.src ?? '';
    const activeTime = prevActive?.element.currentTime ?? 0;
    const idleSrc = this.idle?.element.src ?? '';

    for (const slot of [this.slotA, this.slotB]) {
      slot.element.pause();
      slot.element.removeAttribute('src');
    }

    this.buildElements();
    this.activeSlot = prevActiveSlot;
    this.setupAudioContext();

    if (activeSrc && this.active) {
      this.active.element.src = activeSrc;
      this.active.element.currentTime = activeTime;
      this.setGain(this.active, this.userVolume);
      if (wasPlaying) this.active.element.play().catch(() => {});
    }
    if (idleSrc && this.idle) {
      this.idle.element.src = idleSrc;
      this.setGain(this.idle, this.userVolume);
      this.idle.element.load();
    }
  }

  /** Best-effort resume — AudioContext starts (or ends up) suspended/interrupted until a user gesture (or
   *  the interruption itself) clears, same class of restriction `el.play()` already navigates below. */
  private resumeAudioContext() {
    const state = this.audioContext?.state as AudioContextState | 'interrupted' | undefined;
    if (state === 'suspended' || state === 'interrupted') {
      this.audioContext?.resume().catch(() => {});
    } else if (state === 'closed') {
      this.rebuildAfterClose();
    }
  }

  /** Sets a slot's volume: via its GainNode when Web Audio is wired up, else directly on the element. */
  private setGain(slot: Slot, value: number) {
    if (slot.gain) {
      slot.gain.gain.value = value;
    } else {
      slot.element.volume = value;
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
        let bufferedEnd = 0;
        const cur = el.currentTime;
        for (let i = 0; i < el.buffered.length; i++) {
          if (cur >= el.buffered.start(i) - 0.5 && cur <= el.buffered.end(i)) {
            bufferedEnd = el.buffered.end(i);
            break;
          }
        }
        if (bufferedEnd === 0 && el.buffered.start(0) <= 1.0) {
          bufferedEnd = el.buffered.end(0);
        }
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
      if (this.isCrossfading && this.activeSlot === slot) {
        // This is the outgoing side of an in-progress crossfade, and it just finished on its own — finish
        // the bookkeeping now rather than wait for the scheduled setTimeout (harmless either way for the
        // audio itself, which is already correct via the GainNode schedule regardless of when this runs).
        this.finishCrossfade();
        return;
      }
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

  private get active(): Slot | null {
    return this.activeSlot === 'A' ? this.slotA : this.slotB;
  }

  private get idle(): Slot | null {
    return this.activeSlot === 'A' ? this.slotB : this.slotA;
  }

  get activeElement(): HTMLAudioElement | null {
    return this.active?.element ?? null;
  }

  get idleElement(): HTMLAudioElement | null {
    return this.idle?.element ?? null;
  }

  /**
   * Loads a stream URL into the active element and begins playback.
   */
  async loadAndPlay(url: string, startPosition = 0): Promise<void> {
    const slot = this.active;
    if (!slot) return;

    this.cancelCrossfade();
    // Ensure the idle element is stopped so no audio plays simultaneously
    if (this.idle) {
      this.idle.element.pause();
      this.idle.element.removeAttribute('src');
      this.idle.element.load();
    }
    this.callbacks.onBuffered?.(0);
    slot.element.src = url;
    this.setGain(slot, this.userVolume);
    if (startPosition > 0) {
      slot.element.currentTime = startPosition;
    }

    this.resumeAudioContext();
    try {
      await slot.element.play();
    } catch (err) {
      // Browser autoplay policy or abort
      console.warn('[AudioGraph] Play rejected:', err);
    }
  }

  /**
   * Preloads the next track into the idle element.
   */
  preload(url: string) {
    const slot = this.idle;
    if (!slot) return;

    slot.element.src = url;
    this.setGain(slot, this.userVolume);
    slot.element.preload = 'auto';
    slot.element.load();
  }

  /**
   * Swaps immediately to the preloaded element for gapless playback.
   */
  async swapToPreloaded(): Promise<void> {
    const prev = this.active;
    const next = this.idle;

    if (!next?.element.src) return;

    this.activeSlot = this.activeSlot === 'A' ? 'B' : 'A';

    if (prev) {
      prev.element.pause();
      prev.element.removeAttribute('src');
      prev.element.load();
    }

    this.setGain(next, this.userVolume);

    this.resumeAudioContext();
    try {
      await next.element.play();
    } catch (err) {
      console.warn('[AudioGraph] Swap play error:', err);
    }
  }

  /**
   * Performs an audio crossfade transition over crossfadeSeconds. The fade itself is a GainNode
   * automation schedule handed to the audio thread up front — it keeps running sample-accurately even if
   * the page is backgrounded (e.g. the screen locks on mobile), unlike stepping `.volume` by hand from a
   * requestAnimationFrame loop, which stalls right when that happens. setTimeout below is only bookkeeping
   * (swap the active slot, tear down the outgoing element, call onComplete) — if it runs late, the audio
   * is already correct by then regardless.
   */
  startCrossfade(crossfadeSeconds: number, onComplete: () => void) {
    const outgoing = this.active;
    const incoming = this.idle;

    // No real fade is possible without Web Audio (setupAudioContext fell back) — there's no more manual
    // per-frame stepping to fall back to either (that's the whole point of this being gone), so a clean
    // gapless swap is the honest degradation, not a half-implemented pseudo-fade.
    if (
      !outgoing?.gain ||
      !incoming?.gain ||
      !incoming.element.src ||
      !this.audioContext ||
      crossfadeSeconds <= 0
    ) {
      this.swapToPreloaded().then(onComplete);
      return;
    }

    this.isCrossfading = true;
    this.crossfadeOnComplete = onComplete;
    const targetVol = this.userVolume;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const end = now + crossfadeSeconds;

    // Cancel any stale automation left on these params (e.g. a setGain snap from a prior track load)
    // before scheduling, so each ramp starts from the value actually in effect right now.
    outgoing.gain.gain.cancelScheduledValues(now);
    outgoing.gain.gain.setValueAtTime(outgoing.gain.gain.value, now);
    outgoing.gain.gain.linearRampToValueAtTime(0, end);
    incoming.gain.gain.cancelScheduledValues(now);
    incoming.gain.gain.setValueAtTime(0, now);
    incoming.gain.gain.linearRampToValueAtTime(targetVol, end);

    this.resumeAudioContext();
    incoming.element.play().catch(() => {});

    this.crossfadeTimeoutId = setTimeout(() => this.finishCrossfade(), crossfadeSeconds * 1000);
  }

  /** Completes the current crossfade: swaps the active slot, snaps the incoming track's gain to the target
   *  volume, and tears down the outgoing one — whether reached by the scheduled setTimeout, the outgoing
   *  track ending on its own mid-fade, or the page going hidden mid-fade. */
  private finishCrossfade() {
    if (!this.isCrossfading) return;
    const outgoing = this.active;
    const incoming = this.idle;
    const onComplete = this.crossfadeOnComplete;

    this.cancelCrossfade();
    this.activeSlot = this.activeSlot === 'A' ? 'B' : 'A';
    if (incoming) {
      incoming.gain?.gain.cancelScheduledValues(this.audioContext?.currentTime ?? 0);
      this.setGain(incoming, this.userVolume);
    }
    if (outgoing) {
      outgoing.gain?.gain.cancelScheduledValues(this.audioContext?.currentTime ?? 0);
      this.setGain(outgoing, 0);
      outgoing.element.pause();
      outgoing.element.removeAttribute('src');
      outgoing.element.load();
    }
    onComplete?.();
  }

  private cancelCrossfade() {
    if (this.crossfadeTimeoutId != null) {
      clearTimeout(this.crossfadeTimeoutId);
      this.crossfadeTimeoutId = null;
    }
    this.isCrossfading = false;
    this.crossfadeOnComplete = null;
  }

  play(): Promise<void> | void {
    this.resumeAudioContext();
    return this.activeElement?.play();
  }

  pause() {
    this.cancelCrossfade();
    this.slotA?.element.pause();
    this.slotB?.element.pause();
  }

  seek(seconds: number) {
    if (this.activeElement && Number.isFinite(seconds)) {
      this.activeElement.currentTime = seconds;
    }
  }

  setVolume(volume: number) {
    this.userVolume = Math.max(0, Math.min(1, volume));
    if (this.active) {
      this.setGain(this.active, this.userVolume);
    }
  }

  destroy() {
    this.cancelCrossfade();
    if (this.onVisibilityChange && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.onVisibilityChange = null;
    }
    for (const slot of [this.slotA, this.slotB]) {
      slot?.element.pause();
      slot?.element.removeAttribute('src');
    }
    this.slotA = null;
    this.slotB = null;
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}
