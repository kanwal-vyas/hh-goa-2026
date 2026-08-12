import type { PosterLayout, PosterPalette, TicketShape } from './types';
import { createRng } from '../utils/seed';
import { POSTER_W, POSTER_H } from './design';
import {
  drawPaper,
  drawFitText,
  drawPhoto,
  drawWaves,
  drawSun,
  drawPalm,
  drawStamp,
  drawMark,
  drawRegistrationMarks,
  drawFinalGrain,
} from './primitives';

/**
 * Renders a PosterLayout into a 2D context at the fixed design-space
 * resolution. The caller sets up any transform; everything here draws in
 * 1080 × 1350 coordinates so preview and export share one code path.
 */

export { POSTER_W, POSTER_H, POSTER_RATIO } from './design';

/** Ensure the poster fonts are ready before first paint. */
export async function loadPosterFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const faces = [
    '700 100px "Bodoni Moda"',
    '500 56px "Bodoni Moda"',
    '600 26px "Space Grotesk"',
    '700 26px "Space Grotesk"',
    '700 34px "Caveat"',
  ];
  await Promise.all(faces.map((f) => document.fonts.load(f).catch(() => undefined)));
}

export function renderPoster(
  ctx: CanvasRenderingContext2D,
  layout: PosterLayout,
  img: HTMLImageElement | null
): void {
  const W = POSTER_W;
  const H = POSTER_H;
  const rng = createRng(`render-${layout.seed}`);

  drawPaper(ctx, W, H, layout.palette, rng);

  if (layout.ticket) {
    drawTicket(ctx, layout.ticket, layout.palette, layout.idNumber);
  }

  // giant type behind the photo
  if (layout.ghost && layout.ghostText) {
    drawFitText(ctx, layout.ghostText, layout.ghost);
  }

  // printed sea + palms + sun (drawn under the content objects)
  drawWaves(ctx, layout.waves, W, H);
  for (const pm of layout.palms) drawPalm(ctx, pm, layout.palette.ink);
  if (layout.sun) drawSun(ctx, layout.sun);

  // header + footer bands
  drawFitText(ctx, layout.headerLeft.text ?? '', layout.headerLeft);
  drawFitText(ctx, layout.headerRight.text ?? '', layout.headerRight);
  for (const f of layout.footer) drawFitText(ctx, f.text ?? '', f);

  // the photograph — a physical object on the paper
  drawPhoto(ctx, layout.photo, layout.palette, img);

  // the typographic voice — name + role are the heroes
  drawFitText(ctx, layout.name, layout.nameBlock);
  drawFitText(ctx, layout.role, layout.roleBlock);

  // stamp + hand marks
  drawStamp(ctx, layout.stamp);
  for (const m of layout.marks) drawMark(ctx, m);

  // print furniture + final grain
  drawRegistrationMarks(ctx, W, H, 'rgba(11, 43, 31, 0.3)');
  drawFinalGrain(ctx, W, H, rng);
}

/** The ticket/pass body — panel, border, stub divider, perforation. */
function drawTicket(
  ctx: CanvasRenderingContext2D,
  t: TicketShape,
  palette: PosterPalette,
  idNumber: string
): void {
  const { x, y, w, h } = t;
  const perX = x + t.stubWidth;

  ctx.save();
  // panel
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#f4e9c9');
  g.addColorStop(1, '#efdcae');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = t.borderColor;
  ctx.lineWidth = 3;
  ctx.stroke();
  // inner hairline
  ctx.strokeStyle = 'rgba(11, 43, 31, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x + 10, y + 10, w - 20, h - 20, 6);
  ctx.stroke();

  // pass header inside the body
  ctx.fillStyle = palette.ink;
  ctx.font = '700 26px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('HACKER HOUSE GOA 2026', perX + 28, y + 52);
  ctx.fillStyle = palette.inkSoft;
  ctx.font = '600 20px "Space Grotesk", sans-serif';
  ctx.fillText('ADMIT ONE BUILDER', perX + 28, y + 84);

  // stub ID — big, rotated
  ctx.save();
  ctx.translate(x + t.stubWidth / 2, y + h - 120);
  ctx.rotate((-90 * Math.PI) / 180);
  ctx.fillStyle = palette.accent;
  ctx.font = '700 120px "Bodoni Moda", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`#${idNumber}`, 0, 0);
  ctx.restore();

  // perforation — dashed line + punched holes at the stub edge
  ctx.strokeStyle = 'rgba(11, 43, 31, 0.4)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(perX, y + 14);
  ctx.lineTo(perX, y + h - 14);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = palette.paper;
  ctx.strokeStyle = 'rgba(11, 43, 31, 0.35)';
  ctx.lineWidth = 1.5;
  for (let yy = y + 20; yy < y + h - 10; yy += 34) {
    ctx.beginPath();
    ctx.arc(perX, yy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // "tear here" hand label
  ctx.save();
  ctx.translate(perX + 26, y + 120);
  ctx.rotate((8 * Math.PI) / 180);
  ctx.fillStyle = palette.accent;
  ctx.font = '700 30px "Caveat", cursive';
  ctx.textAlign = 'left';
  ctx.fillText('tear here ✂', 0, 0);
  ctx.restore();

  ctx.restore();
}
