import { describe, expect, it, vi } from 'vitest';
import { tracks } from '$lib/fixtures';
import { player } from './engine.svelte';

describe('PlayerEngine', () => {
  it('initializes with default mock track and sources for shell preview', () => {
    expect(player.currentTrack).toBeDefined();
    expect(player.currentTrack?.title).toBe('केसरिया');
    expect(player.selectedSource).toBeDefined();
    expect(player.selectedSource?.tier).toBe('hires');
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
});
