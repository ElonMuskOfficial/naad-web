import { describe, expect, it } from 'vitest';
import type { Track } from '$lib/types';
import { AudioGraph } from './audio-graph';
import { type ResolvedSources, Scheduler } from './scheduler';

function createDummyTrack(id: string, albumId?: string): Track {
  return {
    id,
    title: `Track ${id}`,
    artists: [{ id: 'art_1', name: 'Artist' }],
    album: albumId
      ? {
          id: albumId,
          title: `Album ${albumId}`,
          images: [],
        }
      : null,
    durationMs: 200_000,
    isrc: null,
    explicit: false,
    discNumber: 1,
    trackNumber: 1,
    images: [],
    quality: null,
    versionTags: [],
  };
}

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

    // Manually prime the preloaded track info
    const dummySources: ResolvedSources = {
      trackId: 'trk_2',
      selected: {
        id: 'src_2',
        provider: 'monochrome',
        tier: 'lossless',
        codec: 'flac',
        container: 'flac',
        mimeType: 'audio/flac',
        bitDepth: 16,
        sampleRate: 44100,
        bitrateKbps: 900,
        durationMs: 200000,
        delivery: 'redirect',
        matchScore: 1,
        normalization: null,
        verifiedAt: '2026-09-23T00:00:00Z',
      },
      alternatives: [],
      play: {
        url: 'https://example.com/stream.flac',
        expiresAt: '2026-09-23T12:00:00Z',
        mimeType: 'audio/flac',
        normalization: null,
      },
    };

    // Inject preloaded state for testing
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedTrack = track2;
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedSources = dummySources;
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

    const dummySources: ResolvedSources = {
      trackId: 'trk_2',
      selected: {
        id: 'src_2',
        provider: 'monochrome',
        tier: 'lossless',
        codec: 'flac',
        container: 'flac',
        mimeType: 'audio/flac',
        bitDepth: 16,
        sampleRate: 44100,
        bitrateKbps: 900,
        durationMs: 200000,
        delivery: 'redirect',
        matchScore: 1,
        normalization: null,
        verifiedAt: '2026-09-23T00:00:00Z',
      },
      alternatives: [],
      play: {
        url: 'https://example.com/stream.flac',
        expiresAt: '2026-09-23T12:00:00Z',
        mimeType: 'audio/flac',
        normalization: null,
      },
    };

    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedTrack = track2;
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedSources = dummySources;
    // @ts-expect-error accessing private property for unit test
    scheduler.preloadedIndex = 1;

    // Remaining time 4s <= crossfade 6s -> triggers crossfade!
    const result = scheduler.checkCrossfade(track1, 196, 200, 6);
    expect(result).toBe(true);
  });
});
