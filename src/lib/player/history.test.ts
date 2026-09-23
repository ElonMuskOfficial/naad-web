import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryTracker } from './history';

describe('HistoryTracker', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('queues listen entries without sending immediately for < 20 items', () => {
    const tracker = new HistoryTracker();
    tracker.record({ trackId: 'trk_1', msPlayed: 45000 });
    tracker.record({ trackId: 'trk_2', msPlayed: 120000 });

    expect(tracker.getPendingCount()).toBe(2);
    expect(fetchSpy).not.toHaveBeenCalled();
    tracker.destroy();
  });

  it('triggers immediate flush when batch reaches 20 items', () => {
    const tracker = new HistoryTracker();
    for (let i = 1; i <= 20; i++) {
      tracker.record({ trackId: `trk_${i}`, msPlayed: 30000 });
    }

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(tracker.getPendingCount()).toBe(0);

    const callBody = JSON.parse(fetchSpy.mock.calls[0]![1].body);
    expect(callBody.listens).toHaveLength(20);
    expect(callBody.listens[0].trackId).toBe('trk_1');
    expect(callBody.listens[19].trackId).toBe('trk_20');
    tracker.destroy();
  });

  it('flushes pending batch after 60s timer expires', () => {
    const tracker = new HistoryTracker();
    tracker.record({ trackId: 'trk_single', msPlayed: 60000 });

    expect(fetchSpy).not.toHaveBeenCalled();

    // Advance 30s - still not called
    vi.advanceTimersByTime(30000);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Advance past 60s - triggers flush
    vi.advanceTimersByTime(30001);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(tracker.getPendingCount()).toBe(0);
    tracker.destroy();
  });

  it('flushes on manual flush call', () => {
    const tracker = new HistoryTracker();
    tracker.record({ trackId: 'trk_manual', msPlayed: 15000 });
    tracker.flush();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(tracker.getPendingCount()).toBe(0);
    tracker.destroy();
  });
});
