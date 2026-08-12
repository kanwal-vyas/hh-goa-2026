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

  // The block's maxWidth is relative to its anchor; clamp it to the design
  // space so left/right/center blocks can never bleed past the paper edge.
  const avail =
    block.align === 'left'
      ? POSTER_W - block.x
      : block.align === 'right'
        ? block.x
        : 2 * Math.min(block.x, POSTER_W - block.x);
  // keep type off the very edge — the registration marks sit at 26px
  const maxWidth = Math.max(40, Math.min(block.maxWidth, avail - 28));

  let size = block.size;
  let lines = [''];
  for (let attempt = 0; attempt < 14; attempt++) {
    setFont(ctx, block.font, size, block.weight ?? 500, block.italic ?? false);
    applyTracking(ctx, block.letterSpacing);
    lines = wrapLines(ctx, raw, maxWidth);
    const fitsLines = lines.length <= maxLines;
    const fitsWidth = lines.every((l) => ctx.measureText(l).width <= maxWidth + 1);
    if (fitsLines && fitsWidth) break;
    size *= 0.92;
  }
  setFont(ctx, block.font, size, block.weight ?? 500, block.italic ?? false);
  applyTracking(ctx, block.letterSpacing);
  lines = wrapLines(ctx, raw, maxWidth).slice(0, maxLines);

  const lh = size * (block.font === 'hand' ? 1.25 : block.italic ? 1.08 : 1.02);
  const totalH = lines.length * lh;
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

  // the photograph itself — clean rect, object-fit cover
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip();
  if (img && img.complete && img.naturalWidth > 0) {
    // cover-crop with a face-safe focal anchor: never stretch, never
    // distort. Portrait photos anchor toward the upper-middle (where faces
    // live); a tiny seeded horizontal bias applies only when the photo is
    // noticeably wider than the frame, so a face can never be pushed out.
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const overflowX = dw - w;
    const overflowY = dh - h;
    const seedH = (rngX(p.tearSeed, 4242, 1) - 0.5); // -0.5..0.5, deterministic
    const hBias = overflowX > overflowY * 0.4 ? seedH * 0.16 : 0;
    const ox = -overflowX * (0.5 + hBias);
    const oy = -overflowY * 0.36; // faces sit in the upper-middle
    ctx.drawImage(img, ox, oy, dw, dh);
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
  // subtle photo paper grain
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#222222';
    ctx.fillRect(rngX(p.tearSeed, i, w), rngY(p.tearSeed, i, h), 1.2, 1.2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

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
  for (let li = 0; li < layers; li++) {
    const color = band.colors[li];
    const baseY = band.y - li * (band.amp * 0.55);
    const amp = band.amp * (1 + li * 0.18);
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, baseY);
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * w;
      const t = i / N;
      const y =
        baseY -
        Math.sin(t * Math.PI * 2 + band.seed) * amp * 0.55 -
        Math.sin(t * Math.PI * 4 + band.seed * 1.7) * amp * 0.28 -
        amp * 0.15;
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
  const topY = band.y - (layers - 1) * (band.amp * 0.55) - band.amp * 0.7;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * w;
    const y = topY - Math.sin(i * 0.55 + band.seed * 2) * 9;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
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
/* Palm silhouette (printed)                                           */
/* ------------------------------------------------------------------ */

/**
 * Compact printed palm silhouette: a curved trunk plus a small fan of
 * sawtooth blades — the same anatomy as the live background palms, reduced
 * to a solid ink mark.
 */
export function drawPalm(ctx: CanvasRenderingContext2D, pm: PalmMark, color: string): void {
  ctx.save();
  ctx.globalAlpha = pm.opacity;
  ctx.translate(pm.x, pm.y);
  const h = pm.h;
  const lean = pm.lean * h * 0.22;
  const crownX = lean;
  const crownY = -h;

  // trunk
  ctx.strokeStyle = color;
  ctx.lineWidth = h * 0.06;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(lean * 0.55, -h * 0.52, crownX, crownY);
  ctx.stroke();

  // frond blades
  ctx.fillStyle = color;
  const blades = 6;
  const rng = createRng(`palm-${pm.seed}`);
  for (let i = 0; i < blades; i++) {
    const f = i / (blades - 1) - 0.5;
    const ang = Math.PI / 2 + f * 1.9 + (rng() - 0.5) * 0.12;
    const len = h * (0.5 + Math.abs(f) * 0.28) * (0.82 + rng() * 0.3);
    const tipX = crownX + Math.cos(ang) * len;
    const tipY = crownY + Math.sin(ang) * len;
    const midX = crownX + Math.cos(ang) * len * 0.5;
    const midY = crownY + Math.sin(ang) * len * 0.5 + len * 0.12;
    // blade with two notches — a simple sawtooth silhouette
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    const teeth = 2;
    for (let k = 0; k < teeth; k++) {
      const tt = 0.35 + (k / teeth) * 0.5;
      const px = crownX + Math.cos(ang) * len * tt;
      const py = crownY + Math.sin(ang) * len * tt;
      ctx.lineTo(px + Math.cos(ang) * 14, py + Math.sin(ang) * 14);
    }
    ctx.closePath();
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
