import { renderPoster, loadPosterFonts } from './renderPoster';
import { POSTER_W, POSTER_H } from './design';
import type { PosterLayout } from './types';

/**
 * Renders the poster to an offscreen canvas at 2× the design space
 * (2160 × 2700) and downloads it as PNG. The exported image is the actual
 * composition — no browser UI, no buttons, no surrounding page. The same
 * render path is used by the preview and the share flow, so the downloaded
 * / shared image is always identical to what the user saw.
 */

export const EXPORT_SCALE = 2;

/** Render the poster to an offscreen canvas at the export resolution. */
export async function renderPosterCanvas(
  layout: PosterLayout,
  img: HTMLImageElement | null,
  scale = EXPORT_SCALE
): Promise<HTMLCanvasElement | null> {
  await loadPosterFonts();
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_W * scale;
  canvas.height = POSTER_H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  renderPoster(ctx, layout, img);
  return canvas;
}

/** Render the poster to a PNG blob (used for download and X share). */
export async function renderPosterBlob(
  layout: PosterLayout,
  img: HTMLImageElement | null
): Promise<Blob | null> {
  const canvas = await renderPosterCanvas(layout, img);
  if (!canvas) return null;
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export async function downloadPosterPNG(layout: PosterLayout, img: HTMLImageElement | null): Promise<void> {
  const blob = await renderPosterBlob(layout, img);
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `frame-in-goa-${layout.idNumber}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
