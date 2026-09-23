import { describe, expect, it } from 'vitest';
import { extractPaletteFromPixels } from './ambient';

describe('Ambient Color: extractPaletteFromPixels', () => {
  it('extracts dominant color from a solid colored pixel buffer', () => {
    // 16 pixels of pure vibrant red (220, 30, 30, 255)
    const pixels: number[] = [];
    for (let i = 0; i < 16; i++) {
      pixels.push(220, 30, 30, 255);
    }

    const palette = extractPaletteFromPixels(pixels, 2);
    expect(palette.ambient1).toBe('rgb(220, 30, 30)');
  });

  it('separates two distinct color clusters via median-cut', () => {
    // 8 blue pixels and 8 green pixels
    const pixels: number[] = [];
    for (let i = 0; i < 8; i++) {
      pixels.push(30, 30, 220, 255); // Blue
    }
    for (let i = 0; i < 8; i++) {
      pixels.push(30, 220, 30, 255); // Green
    }

    const palette = extractPaletteFromPixels(pixels, 2);
    expect(palette.ambient1).toBeDefined();
    expect(palette.ambient2).toBeDefined();

    // Check that one is bluish and one is greenish
    const colors = [palette.ambient1, palette.ambient2].join(' ');
    expect(colors).toContain('220');
  });

  it('falls back to default dark palette for empty or near-black inputs', () => {
    const emptyPixels: number[] = [];
    const emptyPalette = extractPaletteFromPixels(emptyPixels);
    expect(emptyPalette.ambient1).toBe('rgb(40, 38, 36)');

    // 16 pure black pixels (brightness < 8 filtered out)
    const blackPixels: number[] = [];
    for (let i = 0; i < 16; i++) {
      blackPixels.push(0, 0, 0, 255);
    }
    const blackPalette = extractPaletteFromPixels(blackPixels);
    expect(blackPalette.ambient1).toBe('rgb(40, 38, 36)');
  });
});
