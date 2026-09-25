/**
 * Image quality enhancements and proxy routing for NAAD.
 */

/**
 * Upgrades known CDN low-res image patterns (Apple Music / iTunes, JioSaavn, YouTube)
 * to high-resolution equivalents.
 */
export function upgradeImageUrl(url?: string | null, preferredSize = 600): string | undefined {
  if (!url) return undefined;
  let upgraded = url;
  // Apple Music: /100x100bb.jpg -> /600x600bb.jpg
  upgraded = upgraded.replace(
    /\/\d+x\d+bb\.([a-zA-Z0-9]+)/i,
    (_, ext) => `/${preferredSize}x${preferredSize}bb.${ext}`,
  );
  // JioSaavn: -50x50.jpg or -150x150.jpg -> -500x500.jpg
  upgraded = upgraded.replace(/-(?:50x50|150x150)\.([a-zA-Z0-9]+)/i, (_, ext) => `-500x500.${ext}`);
  // YouTube user content: =w120-h120 -> =w544-h544
  upgraded = upgraded.replace(
    /=w\d+-h\d+/i,
    () => `=w${Math.min(preferredSize, 1200)}-h${Math.min(preferredSize, 1200)}`,
  );
  return upgraded;
}

/**
 * Picks the best image from an array of image descriptors based on desired dimensions
 * and applies CDN resolution upgrades.
 */
export function bestImageUrl(
  images?: Array<{ url: string; width?: number | null; height?: number | null } | undefined> | null,
  preferredSize = 500,
): string | undefined {
  if (!images || images.length === 0) return undefined;
  const valid = images.filter((img): img is { url: string; width?: number | null; height?: number | null } =>
    Boolean(img?.url),
  );
  if (valid.length === 0) return undefined;

  const withWidth = valid.filter((img) => typeof img.width === 'number' && img.width > 0);
  let chosenUrl = valid[0]!.url;

  if (withWidth.length > 0) {
    withWidth.sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
    const match =
      withWidth.find((img) => (img.width ?? 0) >= preferredSize) ?? withWidth[withWidth.length - 1];
    chosenUrl = match!.url;
  } else if (valid.length > 1) {
    // APIs typically sort ascending: the last image is the highest resolution
    chosenUrl = valid[valid.length - 1]!.url;
  }

  return upgradeImageUrl(chosenUrl, preferredSize);
}

/**
 * Generates an artwork proxy URL for an image source.
 * Proxies through /v1/art to ensure CORS readability and template resizing.
 */
export function artUrl(src?: string | null, size?: number): string | undefined {
  if (!src) return undefined;
  if (src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }
  const upgradedSrc = upgradeImageUrl(src, size ? Math.max(size, 400) : 600) ?? src;
  if (upgradedSrc.includes('saavncdn.com')) {
    return upgradedSrc;
  }
  const params = new URLSearchParams();
  params.set('src', upgradedSrc);
  if (size && size > 0) {
    // Request at least 1.5x-2x for crisp Retina/High-DPI rendering
    const renderSize = Math.max(Math.round(size * 1.5), 160);
    params.set('size', String(renderSize));
  }
  return `/v1/art?${params.toString()}`;
}
