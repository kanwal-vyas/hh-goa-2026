import type { PosterLayout, PosterPalette, TicketShape } from './types';
import { createRng } from '../utils/seed';
import { POSTER_W, POSTER_H } from './design';
import palmSceneUrl from '../assets/palm-tree.png';
import {
  drawPaper,
  drawFitText,
  drawPhoto,
  drawWaves,
  drawShore,
  drawSun,
  drawStamp,
  drawMark,
  drawRegistrationMarks,
  drawFinalGrain,
  roundedRectPath,
  irregularRectPath,
} from './primitives';

/**
 * Renders a PosterLayout into a 2D context at the fixed design-space
 * resolution. The caller sets up any transform; everything here draws in
 * 1080 × 1350 coordinates so preview and export share one code path.
 */

export { POSTER_W, POSTER_H, POSTER_RATIO } from './design';

/* The footer palms come from the palm-tree.png illustration (a vector
   silhouette scene: sun, birds, palm, reeds, dunes) — loaded once and
   shared by the preview and the export paths. */
let palmImg: HTMLImageElement | null = null;
let palmImgPromise: Promise<HTMLImageElement> | null = null;

function loadPalmImage(): Promise<HTMLImageElement> {
  if (palmImg) return Promise.resolve(palmImg);
  if (!palmImgPromise) {
    palmImgPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        palmImg = img;
        resolve(img);
      };
      img.onerror = () => reject(new Error('Failed to load palm-tree.png'));
      img.src = palmSceneUrl;
    });
  }
  return palmImgPromise;
}

/* The ink-tinted silhouette is pre-rendered once per ink color on an
   offscreen canvas — where source-in is safe — so the poster canvas is
   only ever touched with plain source-over draws. */
let palmSprite: HTMLCanvasElement | null = null;
let palmSpriteInk = '';

function getPalmSprite(ink: string): HTMLCanvasElement | null {
  const img = palmImg;
  if (!img) return null;
  if (palmSprite && palmSpriteInk === ink) return palmSprite;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext('2d');
  if (!x) return null;
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = ink;
  x.fillRect(0, 0, c.width, c.height);
  palmSprite = c;
  palmSpriteInk = ink;
  return c;
}

/** Ensure the poster fonts — and the palm illustration — are ready before paint. */
export async function loadPosterFonts(): Promise<void> {
  const jobs: Array<Promise<unknown>> = [loadPalmImage().catch(() => undefined)];
  if (typeof document !== 'undefined' && 'fonts' in document) {
    const faces = [
      '700 100px "Bodoni Moda"',
      '500 56px "Bodoni Moda"',
      '600 26px "Space Grotesk"',
      '700 26px "Space Grotesk"',
      '700 34px "Caveat"',
    ];
    jobs.push(...faces.map((f) => document.fonts.load(f).catch(() => undefined)));
  }
  await Promise.all(jobs);
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

  // printed sea + sandy shore + palms + sun (drawn under the content
  // objects) — the footer reads as a beach: ocean above, sand below,
  // palms growing from the shore
  drawWaves(ctx, layout.waves, W, H);
  drawShore(ctx, W, H, 1272, layout.waves.seed);
  const palmSprite = getPalmSprite(layout.palette.ink);
  if (palmSprite) {
    for (const pm of layout.palms) drawPalmScene(ctx, palmSprite, pm);
  }
  if (layout.sun) drawSun(ctx, layout.sun);

  // asymmetric pigment block (variant E)
  if (layout.paint) {
    ctx.save();
    ctx.globalAlpha = layout.paint.opacity ?? 1;
    ctx.translate(layout.paint.x, layout.paint.y);
    ctx.rotate((layout.paint.rotation * Math.PI) / 180);
    irregularRectPath(ctx, 0, 0, layout.paint.w, layout.paint.h, layout.paint.seed, 7);
    ctx.fillStyle = layout.paint.color;
    ctx.fill();
    ctx.restore();
  }

  // header + footer bands
  drawFitText(ctx, layout.headerLeft.text ?? '', layout.headerLeft);
  drawFitText(ctx, layout.headerRight.text ?? '', layout.headerRight);
  // the footer sits on the beach — solid ink plus a soft shadow so it
  // always separates from the sand and sea behind it
  ctx.save();
  ctx.shadowColor = 'rgba(11, 43, 31, 0.3)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  for (const f of layout.footer) drawFitText(ctx, f.text ?? '', f);
  ctx.restore();

  // the photograph — a physical object on the paper
  drawPhoto(ctx, layout.photo, layout.palette, img);

  // the typographic voice — name + role are the heroes, the builder title
  // is the handwritten accent; a soft ink shadow keeps the delicate
  // high-contrast display type readable against the paper
  ctx.save();
  ctx.shadowColor = 'rgba(11, 43, 31, 0.32)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 2;
  drawFitText(ctx, layout.name, layout.nameBlock);
  drawFitText(ctx, layout.role, layout.roleBlock);
  drawFitText(ctx, layout.title, layout.titleBlock);
  ctx.restore();

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
  roundedRectPath(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = t.borderColor;
  ctx.lineWidth = 3;
  ctx.stroke();
  // inner hairline
  ctx.strokeStyle = 'rgba(11, 43, 31, 0.18)';
  ctx.lineWidth = 1.5;
  roundedRectPath(ctx, x + 10, y + 10, w - 20, h - 20, 6);
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

/**
 * Draws the ink-tinted palm illustration on the beach. The layout's palm
 * marks position the PNG: bottom-center anchored at (x, y) on the sand,
 * height = h, mirrored when lean points inward. The tint is baked into the
 * sprite already, so this is a plain source-over draw.
 */
function drawPalmScene(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  pm: { x: number; y: number; h: number; lean: number; opacity: number }
): void {
  const aspect = sprite.width / sprite.height;
  const w = pm.h * aspect;
  const half = w / 2;

  ctx.save();
  ctx.globalAlpha = pm.opacity;
  if (pm.lean < 0) {
    ctx.translate(pm.x + half, pm.y);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(pm.x - half, pm.y);
  }
  ctx.drawImage(sprite, 0, -pm.h, w, pm.h);
  ctx.restore();
}
