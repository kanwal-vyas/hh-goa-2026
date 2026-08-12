import { renderPoster, loadPosterFonts } from './renderPoster';
import { POSTER_W, POSTER_H } from './design';
import type { PosterLayout } from './types';

/**
 * Renders the poster to an offscreen canvas at 2× the design space
 * (2160 × 2700) and downloads it as PNG. The exported image is the actual
 * composition — no browser UI, no buttons, no surrounding page.
 */

export const EXPORT_SCALE = 2;

export async function downloadPosterPNG(layout: PosterLayout, img: HTMLImageElement | null): Promise<void> {
  await loadPosterFonts();

  const canvas = document.createElement('canvas');
  canvas.width = POSTER_W * EXPORT_SCALE;
  canvas.height = POSTER_H * EXPORT_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);
  renderPoster(ctx, layout, img);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
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
