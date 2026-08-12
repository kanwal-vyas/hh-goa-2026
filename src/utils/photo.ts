/**
 * Photo preparation for the upload pipeline.
 *
 * iPhones export HEIC/HEIF, which most browsers cannot render in an <img>.
 * We detect it and convert client-side to JPEG via heic2any (libheif WASM)
 * — no server, no upload: the photo never leaves the browser. The original
 * file's metadata still feeds the deterministic seed, so the same HEIC
 * always produces the same poster.
 */

const HEIC_MIMES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
const HEIC_EXT = /\.heic$/i;

export function isHeic(file: File): boolean {
  return HEIC_MIMES.has(file.type) || HEIC_EXT.test(file.name);
}

export interface PreparedPhoto {
  /** The blob to render — the original, or the converted JPEG for HEIC. */
  blob: Blob;
  /** The original file, kept for deterministic seed metadata. */
  original: File;
}

/**
 * Returns a renderable blob. For HEIC input this converts to JPEG in the
 * browser; for JPG/PNG (and anything already renderable) it returns the
 * file unchanged. Throws if conversion fails so callers can fall back.
 */
export async function preparePhotoFile(file: File): Promise<PreparedPhoto> {
  if (!isHeic(file)) {
    return { blob: file, original: file };
  }

  const { default: heic2any } = await import('heic2any');
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.92,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return { blob, original: file };
}
