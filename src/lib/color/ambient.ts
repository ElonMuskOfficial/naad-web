import { artUrl } from '$lib/art';

export interface AmbientPalette {
  ambient1: string; // Primary ambient color: rgb(r, g, b)
  ambient2: string; // Secondary ambient color: rgb(r, g, b)
}

const DEFAULT_PALETTE: AmbientPalette = {
  ambient1: 'rgb(40, 38, 36)',
  ambient2: 'rgb(24, 23, 22)',
};

const paletteCache = new Map<string, AmbientPalette>();

interface ColorBox {
  pixels: Array<[number, number, number]>;
}

function findBoxRange(box: ColorBox): { channel: 0 | 1 | 2; range: number } {
  let minR = 255;
  let maxR = 0;
  let minG = 255;
  let maxG = 0;
  let minB = 255;
  let maxB = 0;

  for (const [r, g, b] of box.pixels) {
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (g < minG) minG = g;
    if (g > maxG) maxG = g;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
  }

  const rangeR = maxR - minR;
  const rangeG = maxG - minG;
  const rangeB = maxB - minB;

  if (rangeR >= rangeG && rangeR >= rangeB) {
    return { channel: 0, range: rangeR };
  }
  if (rangeG >= rangeR && rangeG >= rangeB) {
    return { channel: 1, range: rangeG };
  }
  return { channel: 2, range: rangeB };
}

function splitBox(box: ColorBox, channel: 0 | 1 | 2): [ColorBox, ColorBox] {
  box.pixels.sort((a, b) => a[channel] - b[channel]);
  const mid = Math.floor(box.pixels.length / 2);
  return [{ pixels: box.pixels.slice(0, mid) }, { pixels: box.pixels.slice(mid) }];
}

function averageColor(box: ColorBox): [number, number, number] {
  if (box.pixels.length === 0) return [30, 30, 30];
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (const [r, g, b] of box.pixels) {
    sumR += r;
    sumG += g;
    sumB += b;
  }
  const len = box.pixels.length;
  return [Math.round(sumR / len), Math.round(sumG / len), Math.round(sumB / len)];
}

/**
 * Pure median-cut palette extraction algorithm on a pixel array.
 * Works on Uint8ClampedArray (from canvas) or standard number array.
 */
export function extractPaletteFromPixels(
  pixelData: Uint8ClampedArray | number[],
  numColors = 4,
): AmbientPalette {
  const pixels: Array<[number, number, number]> = [];

  for (let i = 0; i < pixelData.length; i += 4) {
    const r = pixelData[i] ?? 0;
    const g = pixelData[i + 1] ?? 0;
    const b = pixelData[i + 2] ?? 0;
    const a = pixelData[i + 3] ?? 255;

    // Filter out transparent and pure black/white pixels for cleaner ambient tint
    if (a < 128) continue;
    const brightness = (r + g + b) / 3;
    if (brightness < 8 || brightness > 250) continue;

    pixels.push([r, g, b]);
  }

  if (pixels.length === 0) {
    return DEFAULT_PALETTE;
  }

  const boxes: ColorBox[] = [{ pixels }];

  while (boxes.length < numColors) {
    // Find the box with largest color range
    let bestBoxIndex = -1;
    let maxRange = -1;
    let bestChannel: 0 | 1 | 2 = 0;

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i]!;
      if (box.pixels.length < 2) continue;
      const { channel, range } = findBoxRange(box);
      if (range > maxRange) {
        maxRange = range;
        bestBoxIndex = i;
        bestChannel = channel;
      }
    }

    if (bestBoxIndex === -1 || maxRange <= 0) {
      break;
    }

    const boxToSplit = boxes[bestBoxIndex]!;
    boxes.splice(bestBoxIndex, 1);
    const [b1, b2] = splitBox(boxToSplit, bestChannel);
    boxes.push(b1, b2);
  }

  // Calculate average color and vibrancy for each box
  const colors = boxes.map((box) => {
    const [r, g, b] = averageColor(box);
    // Vibrancy / saturation heuristic: max diff between channels
    const maxVal = Math.max(r, g, b);
    const minVal = Math.min(r, g, b);
    const saturation = maxVal === 0 ? 0 : (maxVal - minVal) / maxVal;
    return {
      rgb: [r, g, b] as [number, number, number],
      count: box.pixels.length,
      saturation,
    };
  });

  // Sort by vibrancy and pixel count
  colors.sort(
    (a, b) => b.saturation * 1.5 + b.count / pixels.length - (a.saturation * 1.5 + a.count / pixels.length),
  );

  const c1 = colors[0]?.rgb ?? [40, 38, 36];
  const c2 = colors[1]?.rgb ?? [Math.round(c1[0] * 0.7), Math.round(c1[1] * 0.7), Math.round(c1[2] * 0.7)];

  return {
    ambient1: `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`,
    ambient2: `rgb(${c2[0]}, ${c2[1]}, ${c2[2]})`,
  };
}

/**
 * Extracts ambient colors from an artwork URL by drawing it to a 64x64 canvas.
 * Proxies through artUrl for CORS readability. Caches results in memory.
 */
export async function extractAmbientPalette(src: string): Promise<AmbientPalette> {
  if (paletteCache.has(src)) {
    return paletteCache.get(src)!;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return DEFAULT_PALETTE;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(DEFAULT_PALETTE);
          return;
        }

        ctx.drawImage(img, 0, 0, 64, 64);
        const imgData = ctx.getImageData(0, 0, 64, 64);
        const palette = extractPaletteFromPixels(imgData.data);
        paletteCache.set(src, palette);
        resolve(palette);
      } catch (err) {
        console.warn('[AmbientColor] Canvas read failed:', err);
        resolve(DEFAULT_PALETTE);
      }
    };

    img.onerror = () => {
      resolve(DEFAULT_PALETTE);
    };

    // Load via the artwork proxy at 64px for fast, CORS-enabled reading
    img.src = artUrl(src, 64) ?? src;
  });
}

/**
 * Applies ambient CSS variables (--ambient-1, --ambient-2) to the specified DOM element.
 */
export function applyAmbientToElement(element: HTMLElement, palette: AmbientPalette) {
  element.style.setProperty('--ambient-1', palette.ambient1);
  element.style.setProperty('--ambient-2', palette.ambient2);
}
