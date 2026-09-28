import { describe, expect, it, vi } from 'vitest';
import type { Audio, Track } from '$lib/types';
import { AudioGraph } from './audio-graph';
import { Scheduler } from './scheduler';

function createDummyTrack(id: string, albumId?: string): Track {
  return {
    id,
    title: `Track ${id}`,
    artists: [{ id: 'art_1', name: 'Artist' }],
    album: albumId ? { id: albumId, title: `Album ${albumId}`, images: [] } : null,
    durationMs: 200_000,
    explicit: false,
    trackNumber: 1,
    images: [],
    url: null,
  };
}

const dummyAudio: Audio = {
  trackId: 'trk_2',
  url: 'https://example.com/stream.mp4',
  bitrateKbps: 320,
  codec: 'aac',
  mimeType: 'audio/mp4',
  durationMs: 200_000,
};

describe('Scheduler: getNextIndex', () => {
  const dummyGraph = new AudioGraph();
  const scheduler = new Scheduler(dummyGraph);

  it('advances sequentially when repeat is off', () => {
    expect(scheduler.getNextIndex(0, 5, 'off')).toBe(1);
    expect(scheduler.getNextIndex(1, 5, 'off')).toBe(2);
    expect(scheduler.getNextIndex(3, 5, 'off')).toBe(4);
    // End of queue
    expect(scheduler.getNextIndex(4, 5, 'off')).toBe(-1);
  });

  it('wraps to 0 at the end of queue when repeat is all', () => {
    expect(scheduler.getNextIndex(0, 5, 'all')).toBe(1);
    expect(scheduler.getNextIndex(4, 5, 'all')).toBe(0);
  });

  it('returns current index when repeat is one', () => {
    expect(scheduler.getNextIndex(2, 5, 'one')).toBe(2);
    expect(scheduler.getNextIndex(4, 5, 'one')).toBe(4);
  });

  it('returns -1 for empty queue', () => {
    expect(scheduler.getNextIndex(0, 0, 'off')).toBe(-1);
    expect(scheduler.getNextIndex(0, 0, 'all')).toBe(-1);
    expect(scheduler.getNextIndex(0, 0, 'one')).toBe(-1);
  });
});

describe('Scheduler: checkCrossfade album boundary logic', () => {
  it('skips crossfade between consecutive tracks of the SAME album to preserve gapless playback', () => {
    const dummyGraph = new AudioGraph();
    const scheduler = new Scheduler(dummyGraph);

    const track1 = createDummyTrack('trk_1', 'alb_same');
    const track2 = createDummyTrack('trk_2', 'alb_same');

    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedTrack = track2;
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedAudio = dummyAudio;
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedIndex = 1;

    // With 5s remaining and 6s crossfade, should return FALSE because same album!
    const result = scheduler.checkCrossfade(track1, 195, 200, 6);
    expect(result).toBe(false);
  });

  it('triggers crossfade when consecutive tracks are from DIFFERENT albums and remaining time <= crossfadeSeconds', () => {
    const dummyGraph = new AudioGraph();
    const scheduler = new Scheduler(dummyGraph);

    const track1 = createDummyTrack('trk_1', 'alb_A');
    const track2 = createDummyTrack('trk_2', 'alb_B');

    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedTrack = track2;
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedAudio = dummyAudio;
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedIndex = 1;

    // Remaining time 4s <= crossfade 6s -> triggers crossfade!
    const result = scheduler.checkCrossfade(track1, 196, 200, 6);
    expect(result).toBe(true);
  });
});

describe('Scheduler: handleTrackEnded transition ordering', () => {
  it('notifies onTrackTransition before swapping audio, so the swap never runs against stale track info', async () => {
    const dummyGraph = new AudioGraph();
    const order: string[] = [];
    vi.spyOn(dummyGraph, 'swapToPreloaded').mockImplementation(async () => {
      order.push('swap');
    });

    const scheduler = new Scheduler(dummyGraph, {
      onTrackTransition: () => {
        order.push('transition');
      },
    });

    const track1 = createDummyTrack('trk_1');
    const track2 = createDummyTrack('trk_2');
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedTrack = track2;
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedAudio = dummyAudio;
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedIndex = 1;

    await scheduler.handleTrackEnded([track1, track2], 0, 'off');

    // Same reasoning as PlayerEngine.next()'s preloaded-swap path: swapToPreloaded() makes the new element
    // active immediately, and its DOM events are routed to the engine the instant they fire. The transition
    // callback (which updates currentTrack/duration/etc.) must land before that, not after.
    expect(order).toEqual(['transition', 'swap']);
  });
});
