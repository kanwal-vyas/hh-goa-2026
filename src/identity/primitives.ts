import type { PosterPalette, TextBlock, PhotoPlacement, WaveBand, SunMark, PalmMark, Stamp, Mark } from './types';
import { createRng } from '../utils/seed';
import { POSTER_W } from './design';

/**
 * Reusable, deterministic canvas drawing primitives for the Builder ID
 * poster. Everything draws in the 1080 × 1350 design space. All randomness
 * comes from a seeded rng — the same layout always produces the same print.
 */

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Rounded-rect path that works in every browser — falls back to a manual
 * arcTo path where ctx.roundRect is unavailable (older iOS Safari).
 */
export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | number[]
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const topLeft = typeof r === 'number' ? r : (r[0] ?? 0);
  const topRight = typeof r === 'number' ? r : (r[1] ?? topLeft);
  const bottomRight = typeof r === 'number' ? r : (r[2] ?? topRight);
  const bottomLeft = typeof r === 'number' ? r : (r[3] ?? bottomRight);
  const rr = (n: number) => Math.max(0, Math.min(n, w / 2, h / 2));
  const rtl = rr(topLeft);
  const rtr = rr(topRight);
  const rbr = rr(bottomRight);
  const rbl = rr(bottomLeft);
  ctx.beginPath();
  ctx.moveTo(x + rtl, y);
  ctx.lineTo(x + w - rtr, y);
  ctx.arcTo(x + w, y, x + w, y + rtr, rtr);
  ctx.lineTo(x + w, y + h - rbr);
  ctx.arcTo(x + w, y + h, x + w - rbr, y + h, rbr);
  ctx.lineTo(x + rbl, y + h);
  ctx.arcTo(x, y + h, x, y + h - rbl, rbl);
  ctx.lineTo(x, y + rtl);
  ctx.arcTo(x, y, x + rtl, y, rtl);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Fonts & text                                                        */
/* ------------------------------------------------------------------ */

export function setFont(
  ctx: CanvasRenderingContext2D,
  kind: 'display' | 'ui' | 'hand',
  size: number,
  weight = 500,
  italic = false
): void {
  const fam =
    kind === 'display'
      ? '"Bodoni Moda", "Times New Roman", serif'
      : kind === 'ui'
        ? '"Space Grotesk", sans-serif'
        : '"Caveat", cursive';
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${fam}`;
}

function applyTracking(ctx: CanvasRenderingContext2D, px: number | undefined): void {
  // letterSpacing is widely supported on canvas2d now; guard for engines
  // where the property is not (yet) exposed.
  try {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px ?? 0}px`;
  } catch {
    /* noop */
  }
}

export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${line} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

/**
 * Draws a TextBlock with greedy word-wrap and automatic size shrink so the
 * block always fits its maxWidth / maxLines. The block is rotated about its
 * anchor point (x, y).
 */
export function drawFitText(ctx: CanvasRenderingContext2D, text: string, block: TextBlock): void {
  const raw = block.uppercase ? text.toUpperCase() : text;
  const maxLines = block.maxLines ?? 2;

  ctx.save();
  ctx.translate(block.x, block.y);
  ctx.rotate((block.rotation * Math.PI) / 180);
  ctx.textAlign = block.align;
  ctx.textBaseline = 'alphabetic';

  // The block's maxWidth is relative to its anchor; clamp it to the design space
  const avail =
    block.align === 'left'
      ? POSTER_W - block.x
      : block.align === 'right'
        ? block.x
        : 2 * Math.min(block.x, POSTER_W - block.x);
  const maxWidth = Math.max(40, Math.min(block.maxWidth, avail - 28));

  let size = block.size;
  let lines = block.lines ?? [''];

  if (!block.lines || block.lines.length === 0) {
    for (let attempt = 0; attempt < 14; attempt++) {
      setFont(ctx, block.font, size, block.weight ?? 500, block.italic ?? false);
      applyTracking(ctx, block.letterSpacing);
      lines = wrapLines(ctx, raw, maxWidth);
      const fitsLines = lines.length <= maxLines;
      const fitsWidth = lines.every((l) => ctx.measureText(l).width <= maxWidth + 1);
      if (fitsLines && fitsWidth) break;
      size *= 0.92;
    }
  }

  setFont(ctx, block.font, size, block.weight ?? 500, block.italic ?? false);
  applyTracking(ctx, block.letterSpacing);

  if (!block.lines) {
    lines = wrapLines(ctx, raw, maxWidth).slice(0, maxLines);
  }

  const lh = block.lineHeight ?? size * (block.font === 'hand' ? 1.25 : block.italic ? 1.08 : 1.02);
  const totalH = block.measuredHeight ?? lines.length * lh;
  const startY = block.anchor === 'middle' ? -totalH / 2 + lh * 0.8 : 0;

  ctx.fillStyle = block.color;
  lines.forEach((l, i) => {
    ctx.fillText(l, 0, startY + i * lh);
  });

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Paper base                                                          */
/* ------------------------------------------------------------------ */

/**
 * Cream paper with a soft depth gradient, a seeded grain, a slight vignette
 * and a thin ink edge — the "printed artifact" ground of every poster.
 */
export function drawPaper(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: PosterPalette,
  rng: () => number
): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, palette.paper);
  g.addColorStop(0.55, palette.paper);
  g.addColorStop(1, palette.paperDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // seeded print grain — fine dots, barely there
  ctx.save();
  for (let i = 0; i < 2600; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const dark = rng() > 0.5;
    ctx.fillStyle = dark ? 'rgba(90, 60, 20, 0.05)' : 'rgba(255, 255, 250, 0.05)';
    const s = 0.8 + rng() * 1.6;
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();

  // vignette — the print darkens a touch toward the edges
  const v = ctx.createRadialGradient(w / 2, h * 0.46, h * 0.32, w / 2, h * 0.52, h * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(60, 38, 8, 0.10)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(90, 62, 22, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(9, 9, w - 18, h - 18);
}

/* ------------------------------------------------------------------ */
/* Organic paper edge                                                  */
/* ------------------------------------------------------------------ */

/**
 * A softly irregular rectangle path (low-frequency wobble — paper, not a
 * jagged cutout). Points are smoothed through midpoints so the edge reads
 * as an imperfect die-cut rather than a polygon.
 */
export function irregularRectPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  seed: number,
  amp: number
): void {
  const N = 32;
  const per = 2 * (w + h);
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < N; i++) {
    const u = i / N;
    let d = u * per;
    let px: number;
    let py: number;
    if (d < w) {
      px = cx - w / 2 + d;
      py = cy - h / 2;
    } else if (d < w + h) {
      px = cx + w / 2;
      py = cy - h / 2 + (d - w);
    } else if (d < 2 * w + h) {
      px = cx + w / 2 - (d - w - h);
      py = cy + h / 2;
    } else {
      px = cx - w / 2;
      py = cy + h / 2 - (d - 2 * w - h);
    }
    const t = u * Math.PI * 2;
    const n =
      Math.sin(t * 2 + seed) * 0.62 +
      Math.sin(t * 5 + seed * 1.7) * 0.28 +
      Math.sin(t * 11 + seed * 2.9) * 0.1;
    pts.push({ x: px + n * amp, y: py + n * amp });
  }
  ctx.beginPath();
  ctx.moveTo((pts[0].x + pts[N - 1].x) / 2, (pts[0].y + pts[N - 1].y) / 2);
  for (let i = 0; i < N; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % N];
    ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
  }
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Photograph — taped onto the poster                                  */
/* ------------------------------------------------------------------ */

/**
 * The photo is a physical object: an irregular warm paper mat, a clean
 * photograph inset, two pieces of tape, a drop shadow and a handwritten
 * label. The irregularity lives in the MAT (paper), so the photo itself
 * stays crisp — no confusing cutout shapes.
 */
export function drawPhoto(
  ctx: CanvasRenderingContext2D,
  p: PhotoPlacement,
  palette: PosterPalette,
  img: HTMLImageElement | null
): void {
  const { x, y, w, h } = p;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((p.rotation * Math.PI) / 180);

  // drop shadow under the whole object
  ctx.save();
  ctx.shadowColor = 'rgba(40, 22, 4, 0.35)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 14;
  irregularRectPath(ctx, 0, 0, w + p.matInset * 2, h + p.matInset * 2, p.tearSeed, 8);
  ctx.fillStyle = 'rgba(90, 60, 20, 0.5)';
  ctx.fill();
  ctx.restore();

  // the paper mat
  const mg = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  mg.addColorStop(0, palette.photoMat);
  mg.addColorStop(1, '#e9d198');
  irregularRectPath(ctx, 0, 0, w + p.matInset * 2, h + p.matInset * 2, p.tearSeed, 8);
  ctx.fillStyle = mg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 90, 40, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // the photograph itself — an organic paper edge (low-frequency wobble,
  // clearly paper not polygon), object-fit cover inside. The edge is
  // clipped so only the silhouette is irregular; the photo pixels are
  // never displaced or distorted.
  ctx.save();
  irregularRectPath(ctx, 0, 0, w, h, p.tearSeed + 7, 5);
  ctx.clip();
  if (img && img.complete && img.naturalWidth > 0) {
    // perfectly centered cover crop — never stretch, never distort. The
    // frame is centered at the origin, so the image center must land at
    // (0, 0): draw its top-left at (-dw/2, -dh/2).
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  } else {
    // no photo — print a sun mark in the slot so it never looks empty
    ctx.fillStyle = palette.photoPaper;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    drawSun(ctx, { x: 0, y: 0, r: Math.min(w, h) * 0.3, color: palette.sun, rays: 10, seed: p.tearSeed }, 0.9);
    ctx.fillStyle = palette.inkSoft;
    ctx.font = '600 44px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YOUR FACE HERE', 0, 0);
  }
  // photo paper grain — multiply so it sits IN the print
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#3a3a3a';
    ctx.fillRect(rngX(p.tearSeed, i, w), rngY(p.tearSeed, i, h), 1.3, 1.3);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // warm fiber rim along the photo's paper edge — the photo reads as a
  // physical print, not a cutout
  ctx.strokeStyle = 'rgba(255, 252, 240, 0.6)';
  ctx.lineWidth = 2;
  irregularRectPath(ctx, 0, 0, w, h, p.tearSeed + 7, 5);
  ctx.stroke();

  // tape pieces
  for (const t of p.tape) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate((t.rotation * Math.PI) / 180);
    ctx.fillStyle = palette.tape;
    ctx.shadowColor = 'rgba(40, 25, 5, 0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    roundedRectPath(ctx, -t.w / 2, -t.h / 2, t.w, t.h, [2, 7, 3, 6]);
    ctx.fill();
    ctx.restore();
  }

  // handwritten label ("you · name")
  if (p.label) {
    ctx.save();
    ctx.translate(p.label.x, p.label.y);
    ctx.rotate((p.label.rotation * Math.PI) / 180);
    ctx.font = '700 34px "Caveat", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(p.label.text).width;
    ctx.fillStyle = palette.paper;
    ctx.shadowColor = 'rgba(40, 22, 4, 0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    roundedRectPath(ctx, -tw / 2 - 16, -24, tw + 32, 48, [5, 12, 6, 10]);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = p.label.color;
    ctx.fillText(p.label.text, 0, 4);
    ctx.restore();
  }

  ctx.restore();
}

function rngX(seed: number, i: number, w: number): number {
  const s = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * w;
}
function rngY(seed: number, i: number, h: number): number {
  const s = Math.sin(seed * 39.346 + i * 12.9898) * 43758.5453;
  return (s - Math.floor(s)) * h;
}

/* ------------------------------------------------------------------ */
/* Printed waves                                                       */
/* ------------------------------------------------------------------ */

/**
 * Layered printed waves — solid ink bands that rise toward the top of the
 * zone, each with its own seeded undulation, plus thin foam strokes. They
 * read as a screen-printed sea, not a gradient.
 */
export function drawWaves(ctx: CanvasRenderingContext2D, band: WaveBand, w: number, h: number): void {
  const layers = band.colors.length;
  // Enforce environmental zone boundary: wave crests never reach above Y = 1085
  const clampedBandY = Math.max(1180, band.y);
  const clampedAmp = Math.min(48, band.amp);

  for (let li = 0; li < layers; li++) {
    const color = band.colors[li];
    const baseY = clampedBandY - li * (clampedAmp * 0.45);
    const amp = clampedAmp * (1 + li * 0.15);
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, baseY);
    const N = 16;
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * w;
      const t = i / N;
      const rawY =
        baseY -
        Math.sin(t * Math.PI * 2 + band.seed) * amp * 0.45 -
        Math.sin(t * Math.PI * 4 + band.seed * 1.7) * amp * 0.22 -
        amp * 0.1;
      const y = Math.max(1090, rawY);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  // foam strokes riding the top crest
  ctx.strokeStyle = 'rgba(246, 246, 236, 0.8)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const topY = Math.max(1085, clampedBandY - (layers - 1) * (clampedAmp * 0.45) - clampedAmp * 0.5);
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * w;
    const y = Math.max(1082, topY - Math.sin(i * 0.55 + band.seed * 2) * 7);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/* ------------------------------------------------------------------ */
/* Beach shoreline                                                     */
/* ------------------------------------------------------------------ */

/**
 * The sandy foreground of the beach — a warm tan band that runs from a
 * gently undulating shoreline down to the bottom edge, with a pale
 * waterline where the sea meets the sand. It is drawn over the lower part
 * of the wave fill so the poster's footer reads as a proper beach: ocean
 * above, sand below, palms growing from the shore.
 */
export function drawShore(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  topY: number,
  seed: number
): void {
  const N = 20;
  const shoreY = (t: number) =>
    topY - Math.sin(t * Math.PI * 2 + seed) * 6 - Math.sin(t * Math.PI * 5 + seed * 1.7) * 3;

  // sand fill — lighter at the wet shoreline, deepening toward the bottom
  const g = ctx.createLinearGradient(0, topY, 0, h);
  g.addColorStop(0, '#eed9a5');
  g.addColorStop(0.5, '#e9cf97');
  g.addColorStop(1, '#dfbe80');
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, shoreY(0));
  for (let i = 0; i <= N; i++) {
    ctx.lineTo((i / N) * w, shoreY(i / N));
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();

  // pale waterline right at the shore
  ctx.strokeStyle = 'rgba(246, 246, 236, 0.9)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * w;
    const y = shoreY(i / N);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // a touch of damp-sand shading just below the waterline
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#8a6a35';
  ctx.lineWidth = 7;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * w;
    const y = shoreY(i / N) + 12;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* Sun                                                                 */
/* ------------------------------------------------------------------ */

/** Screen-print sun — alternating ray wedges under a solid disc. */
export function drawSun(ctx: CanvasRenderingContext2D, s: SunMark, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(s.x, s.y);
  const rayR = s.r * 1.7;
  for (let i = 0; i < s.rays; i++) {
    const a0 = (i / s.rays) * Math.PI * 2 + s.seed;
    const a1 = ((i + 0.5) / s.rays) * Math.PI * 2 + s.seed;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, rayR, a0, a1);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? s.color : shade(s.color, -0.16);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, s.r, 0, Math.PI * 2);
  ctx.fillStyle = s.color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 80, 10, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt * 255));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt * 255));
  const b = Math.max(0, Math.min(255, (n & 255) + amt * 255));
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/* ------------------------------------------------------------------ */
/* Palm tree (printed)                                                 */
/* ------------------------------------------------------------------ */

/**
 * A printed palm that reads as a palm, not an umbrella: a warm brown
 * segmented trunk that leans from the sand, a drooping fan of fronds
 * (the tips arc downward past the crown, like a real coconut palm) and
 * a small coconut cluster tucked under the crown.
 */
export function drawPalm(
  ctx: CanvasRenderingContext2D,
  pm: PalmMark,
  frondColor: string,
  trunkColor: string
): void {
  ctx.save();
  ctx.globalAlpha = pm.opacity;
  ctx.translate(pm.x, pm.y);
  const h = pm.h;
  const lean = pm.lean * h * 0.24;
  const crownX = lean;
  const crownY = -h;
  const p1x = lean * 0.55;
  const p1y = -h * 0.55;
  const p2x = crownX;
  const p2y = crownY;

  // trunk — a curved warm-brown stem, thicker at the base
  ctx.strokeStyle = trunkColor;
  ctx.lineWidth = h * 0.075;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(p1x, p1y, p2x, p2y);
  ctx.stroke();

  // bark rings — short perpendicular notches along the trunk
  ctx.lineWidth = h * 0.028;
  ctx.globalAlpha = pm.opacity * 0.6;
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const bx = 2 * t * (1 - t) * p1x + t * t * p2x;
    const by = 2 * t * (1 - t) * p1y + t * t * p2y;
    const dx = 2 * (1 - t) * p1x + 2 * t * (p2x - p1x);
    const dy = 2 * (1 - t) * p1y + 2 * t * (p2y - p1y);
    const dl = Math.hypot(dx, dy) || 1;
    const seg = h * 0.045;
    ctx.beginPath();
    ctx.moveTo(bx - (dy / dl) * seg, by + (dx / dl) * seg);
    ctx.lineTo(bx + (dy / dl) * seg, by - (dx / dl) * seg);
    ctx.stroke();
  }
  ctx.globalAlpha = pm.opacity;

  // fronds — a drooping fan radiating from the crown
  ctx.strokeStyle = frondColor;
  const blades = 9;
  const rng = createRng(`palm-${pm.seed}`);
  for (let i = 0; i < blades; i++) {
    const f = i / (blades - 1) - 0.5;
    const ang = Math.PI / 2 + f * 2.1 + (rng() - 0.5) * 0.1;
    const len = h * (0.5 + (0.5 - Math.abs(f)) * 0.3) * (0.82 + rng() * 0.3);
    // the tip arcs downward past the crown — a palm droops, an umbrella doesn't
    const tipX = crownX + Math.cos(ang) * len * 0.88;
    const tipY = crownY + Math.sin(ang) * len * 0.88 + h * 0.16;
    const midX = crownX + Math.cos(ang) * len * 0.5;
    const midY = crownY + Math.sin(ang) * len * 0.5 + h * 0.03;
    ctx.lineWidth = h * 0.034;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.stroke();
    // leaflets along the frond
    const dirX = tipX - crownX;
    const dirY = tipY - crownY;
    const dl = Math.hypot(dirX, dirY) || 1;
    const side = i % 2 === 0 ? 1 : -1;
    ctx.lineWidth = h * 0.02;
    for (let k = 0; k < 3; k++) {
      const tt = 0.38 + (k / 3) * 0.44;
      const lx = (1 - tt) * (1 - tt) * crownX + 2 * tt * (1 - tt) * midX + tt * tt * tipX;
      const ly = (1 - tt) * (1 - tt) * crownY + 2 * tt * (1 - tt) * midY + tt * tt * tipY;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx - (dirY / dl) * h * 0.05 * side, ly + (dirX / dl) * h * 0.05 * side);
      ctx.stroke();
    }
  }

  // coconuts — a small brown cluster just under the crown
  ctx.fillStyle = trunkColor;
  for (let i = 0; i < 3; i++) {
    const a = rng() * Math.PI * 2;
    const rr = h * 0.045 * (0.85 + rng() * 0.3);
    const cx = crownX + Math.cos(a) * h * 0.05;
    const cy = crownY + h * 0.055 + Math.sin(a) * h * 0.03;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Stamp                                                               */
/* ------------------------------------------------------------------ */

/** A physical ink stamp — double ring, slight rotation, offset registration. */
export function drawStamp(ctx: CanvasRenderingContext2D, st: Stamp): void {
  ctx.save();
  ctx.translate(st.x, st.y);
  ctx.rotate((st.rotation * Math.PI) / 180);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = st.color;
  ctx.fillStyle = st.color;
  ctx.lineWidth = 5;

  // offset ghost pass = imperfect ink application
  ctx.save();
  ctx.translate(3, 2);
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(0, 0, st.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0, 0, st.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, st.r * 0.82, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = '700 26px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(st.text1, 0, -12);
  ctx.font = '600 20px "Space Grotesk", sans-serif';
  ctx.fillText(st.text2, 0, 18);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Hand marks                                                          */
/* ------------------------------------------------------------------ */

export function drawMark(ctx: CanvasRenderingContext2D, m: Mark): void {
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate((m.rotation * Math.PI) / 180);
  ctx.strokeStyle = m.color;
  ctx.lineCap = 'round';

  switch (m.kind) {
    case 'arrow': {
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(m.length * 0.45, -m.length * 0.22, m.length, 0);
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(m.length - 14, 12);
      ctx.lineTo(m.length, 0);
      ctx.lineTo(m.length - 30, -4);
      ctx.stroke();
      break;
    }
    case 'underline': {
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(-m.w / 2, 0);
      ctx.quadraticCurveTo(0, 8, m.w / 2, 2);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-m.w / 2 + 10, 8);
      ctx.quadraticCurveTo(m.w * 0.2, 16, m.w / 2 - 6, 10);
      ctx.stroke();
      break;
    }
    case 'star': {
      ctx.fillStyle = m.color;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? m.r : m.r * 0.38;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'scribble': {
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const x = (i / 14) * m.w;
        const y = Math.sin(i * 1.7) * 7 + (i % 2 ? 4 : -4);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

/** Small "+" registration marks at the four corners — print language. */
export function drawRegistrationMarks(ctx: CanvasRenderingContext2D, w: number, h: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const m = 26;
  const s = 20;
  const corners: Array<[number, number]> = [
    [m, m],
    [w - m, m],
    [m, h - m],
    [w - m, h - m],
  ];
  for (const [x, y] of corners) {
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x + s, y);
    ctx.moveTo(x, y - s);
    ctx.lineTo(x, y + s);
    ctx.stroke();
  }
  ctx.restore();
}

/** Fine grain over the finished composition — print texture, not noise. */
export function drawFinalGrain(ctx: CanvasRenderingContext2D, w: number, h: number, rng: () => number): void {
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = rng() > 0.5 ? '#ffffff' : '#1a1a1a';
    ctx.fillRect(rng() * w, rng() * h, 1.2, 1.2);
  }
  ctx.restore();
}
