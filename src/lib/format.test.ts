import { describe, expect, it } from 'vitest';
import { describeQuality, formatDurationMs, formatSampleRate, formatTime, joinArtists } from './format';

describe('format helpers', () => {
  it('formats seconds into timecode', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(59)).toBe('0:59');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3665)).toBe('1:01:05');
    expect(formatTime(-5)).toBe('0:00');
    expect(formatTime(NaN)).toBe('0:00');
  });

  it('formats milliseconds, correctly handling null and undefined', () => {
    expect(formatDurationMs(null)).toBe('');
    expect(formatDurationMs(undefined)).toBe('');
    expect(formatDurationMs(200_040)).toBe('3:20');
  });

  it('formats quality info from codec and bitrate', () => {
    const info = describeQuality({ codec: 'aac', bitrateKbps: 320 });
    expect(info.label).toBe('AAC 320');
    expect(info.detail).toBe('AAC, 320 kbps');
  });

  it('formats sample rate', () => {
    expect(formatSampleRate(44100)).toBe('44.1 kHz');
    expect(formatSampleRate(96000)).toBe('96 kHz');
    expect(formatSampleRate(null)).toBe('—');
  });

  it('joins artists with sleeve conventions', () => {
    expect(joinArtists([])).toBe('');
    expect(joinArtists(['The Weeknd'])).toBe('The Weeknd');
    expect(joinArtists(['Arijit Singh', 'Pritam'])).toBe('Arijit Singh & Pritam');
    expect(joinArtists(['A', 'B', 'C'])).toBe('A, B & C');
  });
});
