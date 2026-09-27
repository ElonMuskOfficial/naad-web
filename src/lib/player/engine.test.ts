import { describe, expect, it, vi } from 'vitest';
import { tracks } from '$lib/fixtures';
import { player } from './engine.svelte';

describe('PlayerEngine', () => {
  it('initializes with clean idle state for production', () => {
    expect(player.currentTrack).toBeNull();
    expect(player.currentAudio).toBeNull();
    expect(player.status).toBe('idle');
    expect(player.currentTime).toBe(0);
    expect(player.duration).toBe(0);
    expect(player.queue).toEqual([]);
  });

  it('cycles repeat modes: off -> all -> one -> off', () => {
    player.repeat = 'off';
    player.toggleRepeat();
    expect(player.repeat).toBe('all');
    player.toggleRepeat();
    expect(player.repeat).toBe('one');
    player.toggleRepeat();
    expect(player.repeat).toBe('off');
  });

  it('clamps volume within [0, 1] range', () => {
    player.setVolume(1.5);
    expect(player.volume).toBe(1);
    player.setVolume(-0.5);
    expect(player.volume).toBe(0);
    player.setVolume(0.75);
    expect(player.volume).toBe(0.75);
  });

  it('toggles shuffle and un-shuffles restoring exact original order', () => {
    // Set a known queue
    const originalTracks = [...tracks];
    player.queue = [...originalTracks];
    // @ts-expect-error setting private for test
    player.unshuffledQueue = [...originalTracks];
    player.currentTrack = originalTracks[0]!;
    player.queueIndex = 0;
    player.shuffle = false;

    // Turn shuffle on
    player.toggleShuffle();
    expect(player.shuffle).toBe(true);
    // Current track remains at top
    expect(player.queue[0]?.id).toBe(originalTracks[0]?.id);
    expect(player.queue).toHaveLength(originalTracks.length);

    // Turn shuffle off -> exact original order restored!
    player.toggleShuffle();
    expect(player.shuffle).toBe(false);
    expect(player.queue.map((t) => t.id)).toEqual(originalTracks.map((t) => t.id));
  });

  it('toggles play/pause state', () => {
    player.currentTrack = tracks[0]!;
    player.currentPlayUrl = 'https://stream.example/track.flac';
    player.status = 'paused';
    player.togglePlay();
    expect(player.status).toBe('playing');
    player.togglePlay();
    expect(player.status).toBe('paused');
  });

  it('seeks within duration bounds', () => {
    player.duration = 200;
    player.seek(50);
    expect(player.currentTime).toBe(50);
    player.seek(-10);
    expect(player.currentTime).toBe(0);
    player.seek(300);
    expect(player.currentTime).toBe(200);
  });

  it('commitSeek clamps within duration', () => {
    player.duration = 200;
    player.commitSeek(150);
    expect(player.currentTime).toBe(150);
    player.commitSeek(-5);
    expect(player.currentTime).toBe(0);
    player.commitSeek(999);
    expect(player.currentTime).toBe(200);
  });

  it('toggles right panel collapse', () => {
    player.rightPanelOpen = true;
    player.toggleRightPanel();
    expect(player.rightPanelOpen).toBe(false);
    player.toggleRightPanel();
    expect(player.rightPanelOpen).toBe(true);
  });

  it('plays from index when playIndex is called', async () => {
    const playTrackSpy = vi.spyOn(player, 'playTrack').mockImplementation(async () => {});
    player.queue = [...tracks];
    await player.playIndex(2);
    expect(player.queueIndex).toBe(2);
    expect(playTrackSpy).toHaveBeenCalledWith(tracks[2]);
    playTrackSpy.mockRestore();
  });

  it('navigates next and previous across queue ends with repeat modes', async () => {
    player.queue = [tracks[0]!, tracks[1]!];
    player.queueIndex = 1; // at end of 2-item queue
    player.repeat = 'off';

    // At end with repeat 'off' -> pauses
    await player.next();
    expect(player.status).toBe('paused');

    // At end with repeat 'all' -> wraps to 0
    player.repeat = 'all';
    player.queueIndex = 1;
    const playIndexSpy = vi.spyOn(player, 'playIndex').mockImplementation(async (idx) => {
      player.queueIndex = idx;
    });

    await player.next();
    expect(playIndexSpy).toHaveBeenCalledWith(0);

    // With repeat 'one' -> restarts current track
    player.repeat = 'one';
    player.currentTime = 50;
    await player.next();
    expect(player.currentTime).toBe(0);

    playIndexSpy.mockRestore();
  });

  it('skips to the next track when audio fails and the refresh retry also fails', async () => {
    const { api } = await import('$lib/api/client');
    const getSpy = vi.spyOn(api, 'GET').mockResolvedValue({
      data: undefined,
      error: { statusCode: 500, error: 'Internal Server Error', message: 'boom' },
      response: new Response(),
    } as never);
    const nextSpy = vi.spyOn(player, 'next').mockImplementation(async () => {});

    player.currentTrack = tracks[0]!;
    // @ts-expect-error private, reached for this test only
    player.retryCount = 0;
    // @ts-expect-error private method, reached for this test only
    await player.handleAudioError(null);

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(nextSpy).toHaveBeenCalledTimes(1);

    getSpy.mockRestore();
    nextSpy.mockRestore();
  });
});

describe('listening history', () => {
  it('records the listen of the track it leaves when skipping to a preloaded next track', async () => {
    const [a, b] = tracks;
    // @ts-expect-error private members, reached for this test only
    const { historyTracker, scheduler, audioGraph } = player;

    player.repeat = 'off';
    player.queue = [a!, b!];
    player.queueIndex = 0;
    player.currentTrack = a!;
    // @ts-expect-error private
    player.listenStartTime = Date.now() - 5000;
    // @ts-expect-error private
    player.listenStartIso = '2026-09-26T10:00:00.000+00:00';

    const record = vi.spyOn(historyTracker, 'record').mockImplementation(() => {});
    vi.spyOn(scheduler, 'preloadedTrackInfo', 'get').mockReturnValue({
      track: b!,
      index: 1,
      audio: {
        url: 'https://cdn.example/b.mp4',
        bitrateKbps: 320,
        codec: 'aac',
        mimeType: 'audio/mp4',
        durationMs: 200_000,
      },
    } as never);
    vi.spyOn(scheduler, 'prepareNextTrack').mockImplementation(async () => {});
    vi.spyOn(scheduler, 'queueChanged').mockImplementation(() => {});
    vi.spyOn(audioGraph, 'swapToPreloaded').mockResolvedValue(undefined as never);

    await player.next();

    expect(player.currentTrack?.id).toBe(b!.id);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        trackId: a!.id,
        completed: false,
        startedAt: '2026-09-26T10:00:00.000+00:00',
      }),
    );
    expect(record.mock.calls[0]![0].msPlayed).toBeGreaterThanOrEqual(5000);
    vi.restoreAllMocks();
  });
});
