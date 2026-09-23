/**
 * Generates an artwork proxy URL for an image source.
 * Proxies through /v1/art to ensure CORS readability and template resizing.
 */
export function artUrl(src?: string | null, size?: number): string | undefined {
  if (!src) return undefined;
  if (src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }
  const params = new URLSearchParams();
  params.set('src', src);
  if (size && size > 0) {
    params.set('size', String(Math.round(size)));
  }
  return `/v1/art?${params.toString()}`;
}
