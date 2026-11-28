/** Receipt image sizing (CLAUDE.md: long edge ≈ 1600 px, JPEG ~0.7). Pure; the device code is in src/media. */

export const LONG_EDGE_PX = 1600;
export const JPEG_QUALITY = 0.7;

/**
 * Target size so the long edge is at most `max` px, keeping the aspect ratio.
 * Returns null when the image is already small enough (never upscales).
 */
export function fitLongEdge(
  width: number,
  height: number,
  max: number = LONG_EDGE_PX,
): { width: number; height: number } | null {
  const long = Math.max(width, height);
  if (long <= max) return null;
  const scale = max / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** File name for page `index` (0-based) of a saved receipt: `page-1.jpg`, `page-2.jpg`, … */
export function receiptPageName(index: number): string {
  return `page-${index + 1}.jpg`;
}
