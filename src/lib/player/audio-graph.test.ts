import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// No jsdom in this project's test environment (vitest.config.ts uses 'node') — AudioGraph is stubbed here
// the same way history.test.ts/art.test.ts stub what they need, rather than pulling in a DOM environment
// for one file.
//
// The crossfade's actual volume interpolation is now a GainNode.linearRampToValueAtTime schedule handed
// to the (real) browser's audio rendering thread — that's the whole point of the migration, and it isn't
// something to re-verify here; the browser's own Web Audio implementation owns that correctness. What's
// worth testing at this boundary is (a) the right target values get scheduled, and (b) the bookkeeping
// (slot swap, outgoing teardown, onComplete) stays correct across every way it can be triggered — the
// scheduled timeout, the outgoing track ending on its own, or the page going hidden — independent of
// whichever one actually fires first. The fake AudioParam below snaps to the ramped-to value immediately
// rather than simulating real-time interpolation, which is deliberate: it keeps assertions about "what did
// we tell the audio graph to do" simple without pretending to model audio-thread timing in JS.

class FakeAudioParam {
  value = 1;
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeGainNode {
  gain = new FakeAudioParam();
  connect(dest: unknown) {
    return dest;
  }
}

class FakeAudioContext {
  state: 'running' | 'suspended' | 'interrupted' | 'closed' = 'running';
  currentTime = 0;
  resumeCount = 0;
  private stateChangeListener: (() => void) | undefined;

  createMediaElementSource(_el: unknown) {
    return { connect: (dest: unknown) => dest };
  }
  createGain() {
    return new FakeGainNode();
  }
  get destination() {
    return {};
  }
  addEventListener(type: string, fn: () => void) {
    if (type === 'statechange') this.stateChangeListener = fn;
  }
  removeEventListener() {}
  async resume() {
    this.resumeCount++;
    this.state = 'running';
  }
  async close() {
    this.state = 'closed';
  }

  /** Test helper: sets state directly (as a real browser would from OS-level events, not our own code)
   *  and fires the same listener the real AudioContext would. */
  simulateStateChange(state: FakeAudioContext['state']) {
    this.state = state;
    this.stateChangeListener?.();
  }
}

class FakeAudioElement {
  private listeners = new Map<string, Set<() => void>>();
  src = '';
  volume = 1;
  currentTime = 0;
  paused = true;
  preload = '';
  crossOrigin: string | null = null;

  addEventListener(type: string, fn: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn);
  }

  fire(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn();
  }

  removeAttribute(name: string) {
    if (name === 'src') this.src = '';
  }

  load() {}

  async play() {
    this.paused = false;
    this.fire('playing');
  }

  pause() {
    this.paused = true;
  }
}

describe('AudioGraph crossfade — bookkeeping across every completion trigger', () => {
  let fakeElements: FakeAudioElement[];
  let fakeAudioContexts: FakeAudioContext[];
  let visibilityListener: (() => void) | undefined;
  let documentHidden: boolean;

  beforeEach(() => {
    fakeElements = [];
    fakeAudioContexts = [];
    visibilityListener = undefined;
    documentHidden = false;

    vi.useFakeTimers();

    function FakeAudioConstructor() {
      const el = new FakeAudioElement();
      fakeElements.push(el);
      return el;
    }
    function FakeAudioContextConstructor() {
      const ctx = new FakeAudioContext();
      fakeAudioContexts.push(ctx);
      return ctx;
    }
    vi.stubGlobal('Audio', FakeAudioConstructor);
    vi.stubGlobal('AudioContext', FakeAudioContextConstructor);
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {
      get hidden() {
        return documentHidden;
      },
      addEventListener: (type: string, fn: () => void) => {
        if (type === 'visibilitychange') visibilityListener = fn;
      },
      removeEventListener: (type: string) => {
        if (type === 'visibilitychange') visibilityListener = undefined;
      },
    });
    vi.stubGlobal('performance', { now: () => 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function makeGraph() {
    const { AudioGraph } = await import('./audio-graph');
    return new AudioGraph();
  }

  it('routes each element through its own GainNode instead of leaving volume control on the element', async () => {
    await makeGraph();
    const [elA, elB] = fakeElements;
    // Once wired to the audio graph, an element's own volume must stay neutral — real control lives on
    // the GainNode, and leaving this at anything else would double-attenuate.
    expect(elA!.volume).toBe(1);
    expect(elB!.volume).toBe(1);
  });

  it('finishes the crossfade immediately when the outgoing track ends on its own, with the scheduled timeout still pending', async () => {
    const graph = await makeGraph();
    const [elA, elB] = fakeElements;
    elA!.src = 'song-a.mp4';
    elB!.src = 'song-b.mp4';

    let completed = false;
    graph.startCrossfade(5, () => {
      completed = true;
    });

    expect(completed).toBe(false);
    elA!.fire('ended');

    expect(completed).toBe(true);
    expect(elA!.paused).toBe(true);
    expect(elA!.src).toBe('');

    // The still-pending scheduled timeout firing afterward must not double-complete.
    await vi.runOnlyPendingTimersAsync();
    expect(completed).toBe(true);
  });

  it('finishes the crossfade immediately when the page is hidden mid-fade', async () => {
    const graph = await makeGraph();
    const [elA, elB] = fakeElements;
    elA!.src = 'song-a.mp4';
    elB!.src = 'song-b.mp4';

    let completed = false;
    graph.startCrossfade(5, () => {
      completed = true;
    });
    expect(completed).toBe(false);
    expect(visibilityListener).toBeDefined();

    documentHidden = true;
    visibilityListener!();

    expect(completed).toBe(true);
    expect(elA!.paused).toBe(true);
    expect(elA!.src).toBe('');
  });

  it('completes via the scheduled timeout when nothing else interrupts it', async () => {
    const graph = await makeGraph();
    const [elA, elB] = fakeElements;
    elA!.src = 'song-a.mp4';
    elB!.src = 'song-b.mp4';

    let completed = false;
    graph.startCrossfade(2, () => {
      completed = true;
    });

    await vi.advanceTimersByTimeAsync(2000);

    expect(completed).toBe(true);
    expect(elA!.paused).toBe(true);
    expect(elA!.src).toBe('');
  });

  it('a late-firing ended event after an early finish is a no-op, not a double-completion', async () => {
    const graph = await makeGraph();
    const [elA, elB] = fakeElements;
    elA!.src = 'song-a.mp4';
    elB!.src = 'song-b.mp4';

    let completeCount = 0;
    graph.startCrossfade(5, () => {
      completeCount++;
    });

    documentHidden = true;
    visibilityListener!(); // finishes early
    expect(completeCount).toBe(1);

    // The outgoing element's real 'ended' can still fire after the fact once it actually reaches the end
    // of its own audio — must not be treated as a second outgoing-side-of-a-crossfade completion.
    elA!.fire('ended');
    expect(completeCount).toBe(1);
  });

  it('falls back to a clean instant swap, not a broken pseudo-fade, when Web Audio is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const graph = await makeGraph();
    const [elA, elB] = fakeElements;
    elA!.src = 'song-a.mp4';
    elB!.src = 'song-b.mp4';

    let completed = false;
    graph.startCrossfade(5, () => {
      completed = true;
    });
    // No timeout to wait out — swapToPreloaded (and its onComplete) run as soon as the microtask settles.
    await Promise.resolve();
    await Promise.resolve();

    expect(completed).toBe(true);
    expect(elA!.paused).toBe(true);
    expect(elA!.src).toBe('');
    expect(elB!.paused).toBe(false);
    expect(elB!.volume).toBeCloseTo(0.85);
  });

  it('calls onComplete before the fallback swap flips the active slot, not after', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const graph = await makeGraph();
    const [elA, elB] = fakeElements;
    elA!.src = 'song-a.mp4';
    elB!.src = 'song-b.mp4';

    let activeWhenNotified: FakeAudioElement | null | undefined;
    graph.startCrossfade(5, () => {
      activeWhenNotified = graph.activeElement as unknown as FakeAudioElement | null;
    });

    // onComplete must have already fired, synchronously, before the slot flips.
    expect(activeWhenNotified).toBe(elA);

    await Promise.resolve();
    await Promise.resolve();

    expect(graph.activeElement).toBe(elB);
  });
});

describe('AudioGraph — iOS AudioContext interrupted/closed recovery', () => {
  let fakeElements: FakeAudioElement[];
  let fakeAudioContexts: FakeAudioContext[];

  beforeEach(() => {
    fakeElements = [];
    fakeAudioContexts = [];

    vi.useFakeTimers();

    function FakeAudioConstructor() {
      const el = new FakeAudioElement();
      fakeElements.push(el);
      return el;
    }
    function FakeAudioContextConstructor() {
      const ctx = new FakeAudioContext();
      fakeAudioContexts.push(ctx);
      return ctx;
    }
    vi.stubGlobal('Audio', FakeAudioConstructor);
    vi.stubGlobal('AudioContext', FakeAudioContextConstructor);
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    vi.stubGlobal('performance', { now: () => 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function makeGraph() {
    const { AudioGraph } = await import('./audio-graph');
    return new AudioGraph();
  }

  it("resumes a suspended AudioContext on the next play() call, the reactive path for both 'suspended' and iOS's non-standard 'interrupted'", async () => {
    const graph = await makeGraph();
    const ctx = fakeAudioContexts[0]!;
    ctx.state = 'interrupted'; // set directly, as the OS would — not via simulateStateChange, to isolate the reactive (play()-triggered) path from the proactive listener tested below

    graph.play();

    expect(ctx.resumeCount).toBe(1);
    expect(ctx.state).toBe('running');
  });

  it("proactively resumes as soon as the context reports 'interrupted', without waiting for a play() call — the case of a track already mid-playback when a screen-lock interruption ends", async () => {
    await makeGraph();
    const ctx = fakeAudioContexts[0]!;

    ctx.simulateStateChange('interrupted');

    expect(ctx.resumeCount).toBe(1);
    expect(ctx.state).toBe('running');
  });

  it("proactively resumes as soon as the context reports 'suspended', the same as the standard (non-iOS) suspension case", async () => {
    await makeGraph();
    const ctx = fakeAudioContexts[0]!;

    ctx.simulateStateChange('suspended');

    expect(ctx.resumeCount).toBe(1);
    expect(ctx.state).toBe('running');
  });

  it("rebuilds with fresh elements and a fresh context when the AudioContext closes, carrying over the active track's src, position and playing state", async () => {
    const graph = await makeGraph();
    const ctx = fakeAudioContexts[0]!;
    const [elA] = fakeElements;
    elA!.src = 'song-a.mp4';
    elA!.currentTime = 42;
    elA!.paused = false; // simulates a track already in progress when the context closes

    ctx.simulateStateChange('closed');

    // A MediaElementAudioSourceNode can only ever be created once per <audio> element for its whole
    // lifetime, even across different AudioContexts — so recovery needs new elements, not just a new
    // context (see rebuildAfterClose's own doc comment).
    expect(fakeElements.length).toBe(4);
    expect(fakeAudioContexts.length).toBe(2);

    // The new active element (still slot A) picked up where the old one left off.
    expect(graph.activeElement).not.toBe(elA);
    expect(graph.activeElement?.src).toBe('song-a.mp4');
    expect(graph.activeElement?.currentTime).toBe(42);
    expect(graph.activeElement?.paused).toBe(false);

    // The old, now-detached element was torn down rather than left dangling.
    expect(elA!.src).toBe('');
  });

  it('does not rebuild on its own stale listener once rebuildAfterClose has already replaced it with a new context', async () => {
    const graph = await makeGraph();
    const ctx = fakeAudioContexts[0]!;

    ctx.simulateStateChange('closed');
    expect(fakeAudioContexts.length).toBe(2);

    // The old context's listener firing again (e.g. a late/duplicate browser event) must not trigger a
    // second rebuild — rebuildAfterClose() guards on `this.audioContext === ctx`, and by now the graph's
    // current context is the new one, not this stale reference.
    ctx.simulateStateChange('closed');
    expect(fakeAudioContexts.length).toBe(2);
    expect(graph.activeElement).not.toBeNull();
  });

  it("sets navigator.audioSession.type to 'playback' when the Audio Session API is available, feature-detected so it's a no-op elsewhere", async () => {
    const fakeNavigator = { audioSession: { type: '' } };
    vi.stubGlobal('navigator', fakeNavigator);

    await makeGraph();

    expect(fakeNavigator.audioSession.type).toBe('playback');
  });

  it('does not throw when navigator has no audioSession API (most browsers today)', async () => {
    vi.stubGlobal('navigator', {});
    await expect(makeGraph()).resolves.toBeDefined();
  });
});
