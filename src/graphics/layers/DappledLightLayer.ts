/**
 * DappledLightLayer — palm-shadow fans drifting like sunlight through trees.
 *
 * Each fan is a small cluster of tapered blades radiating from a base point
 * (the shadow of a palm crown). Blades are filled with a gradient that fades
 * toward the tip and edge, so they read as soft light/dark — not particles
 * and without an expensive canvas blur filter. Fans live in the green band
 * above the waterline and drift on slow independent paths with a gentle
 * angle wobble — organic movement, deliberately nothing like a particle
 * system. Tones include green light/shadow, warm cream light, and ocean blue
 * so the sea participates in the upper environment as well.
 *
 * `settle` quiets the drift and pulls the fans' presence down.
 */

export interface DappleFan {
  x: number; // 0-1 base position within the green band
  y: number; // 0-1 base position within the green band
  scale: number; // 0-1 overall size
  rotation: number; // base fan rotation (radians)
  leafLen: number; // fraction of the green band height
  spread: number; // angular spread of the fan (radians)
  leaflets: number; // blades per fan
  driftX: number; // px drift radius
  driftY: number; // px drift radius
  speed: number;
  phase: number;
  tone: 'green-light' | 'green-dark' | 'ocean' | 'cream';
}

const TONES: DappleFan['tone'][] = ['green-light', 'green-dark', 'ocean', 'cream'];

export function createDappleFans(rng: () => number, count = 3): DappleFan[] {
  return Array.from({ length: count }, (_, i) => ({
    x: 0.12 + rng() * 0.76,
    y: 0.12 + rng() * 0.66,
    scale: 0.8 + rng() * 0.5,
    rotation: rng() * Math.PI * 2,
    leafLen: 0.16 + rng() * 0.1,
    spread: 1.0 + rng() * 0.8,
    leaflets: 4 + Math.floor(rng() * 3),
    driftX: 18 + rng() * 26,
    driftY: 12 + rng() * 20,
    speed: 0.00003 + rng() * 0.00003,
    phase: rng() * Math.PI * 2,
    tone: TONES[i % TONES.length],
  }));
}

function toneColor(tone: DappleFan['tone']): [number, number, number] {
  switch (tone) {
    case 'green-light':
      return [26, 86, 64];
    case 'green-dark':
      return [12, 62, 45];
    case 'ocean':
      return [22, 132, 162];
    case 'cream':
      return [246, 238, 217];
  }
}

export function drawDappledLightLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  timeMs: number,
  settle: number,
  energy: number,
  fans: DappleFan[],
  waterTop: number
): void {
  // fans live in the green band (above the waterline), scaled to it
  const bandH = Math.max(1, waterTop);

  ctx.save();

  for (const f of fans) {
    const t = timeMs * f.speed;
    const calm = 1 - settle * 0.78;
    const dx = Math.sin(t + f.phase) * f.driftX * calm;
    const dy = Math.cos(t * 0.82 + f.phase) * f.driftY * calm;
    const cx = width * f.x + dx;
    const cy = bandH * f.y + dy;
    const len = bandH * f.leafLen * f.scale * (1 - settle * 0.25);
    const baseAngle = f.rotation + Math.sin(t * 0.35 + f.phase) * 0.07 * calm;
    const opacity =
      (0.3 + 0.12 * Math.sin(t * 0.5 + f.phase)) * (1 - settle * 0.35) * (0.6 + 0.4 * energy);
    const [cr, cg, cb] = toneColor(f.tone);
    const n = f.leaflets;

    for (let i = 0; i < n; i++) {
      const fIdx = n === 1 ? 0 : i / (n - 1) - 0.5;
      const ang = baseAngle + fIdx * f.spread;
      const l = len * (0.8 + 0.2 * Math.cos(fIdx * Math.PI));
      const bend = Math.sin(fIdx * 2.7 + f.phase) * l * 0.16;
      const px = -Math.sin(ang);
      const py = Math.cos(ang);
      const tipX = cx + Math.cos(ang) * l;
      const tipY = cy + Math.sin(ang) * l;
      const mx = (cx + tipX) / 2 + px * bend;
      const my = (cy + tipY) / 2 + py * bend;
      const w0 = Math.max(1.5, l * 0.055);

      // gradient along the blade: strongest at the base, dissolving at the
      // tip — softness without a canvas-wide blur filter
      const grad = ctx.createLinearGradient(cx, cy, tipX, tipY);
      grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${opacity})`);
      grad.addColorStop(0.65, `rgba(${cr}, ${cg}, ${cb}, ${opacity * 0.45})`);
      grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);

      ctx.beginPath();
      ctx.moveTo(cx + px * w0, cy + py * w0);
      ctx.quadraticCurveTo(mx, my, tipX, tipY);
      ctx.quadraticCurveTo(mx - px * w0 * 1.6, my - py * w0 * 1.6, cx - px * w0, cy - py * w0);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Side palm shadows — large leaning palm silhouettes framing the hero from
 * the left and right edges.
 *
 * Redesigned for a clean, ICONIC silhouette look (smooth curved trunk +
 * a handful of solid, sawtooth-edged frond blades fanning from the crown),
 * matching classic palm-tree-icon reference art rather than a hyper-real
 * hundreds-of-leaflets render.
 *
 *   trunk (tapered, S-curved)
 *     -> crown point
 *       -> 7–9 frond BLADES, each a single closed, jagged-edged polygon
 *          (spine + alternating spike/notch teeth on both margins,
 *          tapering to a sharp point) — not thin separate ribbons.
 *
 * Everything is deterministic (seeded hash, not Math.random()) so the
 * silhouette shape is stable frame-to-frame; only animation changes it
 * (slow trunk sway + gentle whole-frond rotation about the crown).
 *
 * Drawn before the water layer (unchanged call order), so trunks are
 * naturally masked off at the waterline exactly as before.
 */

type Vec = { x: number; y: number };

// ---------------------------------------------------------------------------
// small deterministic helpers
// ---------------------------------------------------------------------------

/** Deterministic pseudo-random in [0,1) from a numeric seed — no Math.random(). */
function hash(seed: number): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function bezierPoint(p0: Vec, p1: Vec, p2: Vec, t: number): Vec {
  const it = 1 - t;
  return {
    x: it * it * p0.x + 2 * it * t * p1.x + t * t * p2.x,
    y: it * it * p0.y + 2 * it * t * p1.y + t * t * p2.y,
  };
}

/** Normalized tangent of a quadratic bezier at t. */
function bezierTangent(p0: Vec, p1: Vec, p2: Vec, t: number): Vec {
  const it = 1 - t;
  const x = 2 * it * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
  const y = 2 * it * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

/**
 * Fills a tapered ribbon along a quadratic curve. Still used for the trunk,
 * where a smooth continuous taper (rather than a jagged edge) is correct.
 */
function fillTaperedQuad(
  ctx: CanvasRenderingContext2D,
  p0: Vec,
  p1: Vec,
  p2: Vec,
  w0: number,
  w1: number,
  steps: number,
  taperPow = 1
): void {
  const top: Vec[] = [];
  const bottom: Vec[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = bezierPoint(p0, p1, p2, t);
    const tan = bezierTangent(p0, p1, p2, t);
    const nx = -tan.y;
    const ny = tan.x;
    const w = lerp(w0, w1, Math.pow(t, taperPow)) / 2;
    top.push({ x: p.x + nx * w, y: p.y + ny * w });
    bottom.push({ x: p.x - nx * w, y: p.y - ny * w });
  }
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y);
  for (let i = bottom.length - 1; i >= 0; i--) ctx.lineTo(bottom[i].x, bottom[i].y);
  ctx.closePath();
  ctx.fill();
}

function fillPolygon(ctx: CanvasRenderingContext2D, pts: Vec[]): void {
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------------------
// trunk — smooth tapered S-curve, no texture bands (flat icon look)
// ---------------------------------------------------------------------------

interface TrunkResult {
  crown: Vec;
}

function drawPalmTrunk(
  ctx: CanvasRenderingContext2D,
  base: Vec,
  treeH: number,
  inward: 1 | -1,
  seed: number,
  swaySlow: number,
  color: string
): TrunkResult {
  // Reference art reads as ONE confident, continuous curve — not a chained
  // S — so this is a single tapered quadratic bezier: it bulges out toward
  // the control point, then eases back in toward the crown at the top.
  const bendJitter = (hash(seed) - 0.5) * treeH * 0.02;
  const ctrl: Vec = { x: base.x + inward * treeH * 0.5 + bendJitter, y: base.y - treeH * 0.48 };
  const top: Vec = { x: base.x + inward * treeH * 0.14 + swaySlow, y: base.y - treeH };

  const baseW = treeH * 0.07;
  const topW = treeH * 0.018;

  ctx.fillStyle = color;
  fillTaperedQuad(ctx, base, ctrl, top, baseW, topW, 20, 1.05);

  return { crown: top };
}

// ---------------------------------------------------------------------------
// frond blades — solid, sawtooth-edged leaf shapes (the key visual change)
// ---------------------------------------------------------------------------

interface FrondSpec {
  angle: number; // direction the blade points, at rest (radians, canvas coords)
  length: number;
  baseWidth: number;
  lobes: number;
  curveAmt: number; // how much the spine arcs relative to a straight line
  seed: number;
  phase: number;
}

/**
 * Builds one frond as a single closed polygon: a curved spine with pointed
 * "teeth" alternating with shallow notches along both margins, tapering to
 * a sharp tip. This is what gives the classic palm-icon silhouette — solid
 * jagged blades, not a spray of thin separate leaflets.
 */
function buildFrondBlade(crown: Vec, spec: FrondSpec, rot: number): Vec[] {
  const angle = spec.angle + rot;

  // Spine: quadratic curve from crown to tip, bowed sideways by curveAmt.
  const tip: Vec = {
    x: crown.x + Math.cos(angle) * spec.length,
    y: crown.y + Math.sin(angle) * spec.length,
  };
  const perp = { x: -Math.sin(angle), y: Math.cos(angle) };
  const bow = spec.curveAmt * spec.length * (hash(spec.seed + 9) > 0.5 ? 1 : -1);
  const ctrl: Vec = {
    x: crown.x + Math.cos(angle) * spec.length * 0.5 + perp.x * bow,
    y: crown.y + Math.sin(angle) * spec.length * 0.5 + perp.y * bow,
  };

  const spineAt = (t: number) => bezierPoint(crown, ctrl, tip, t);
  const tanAt = (t: number) => bezierTangent(crown, ctrl, tip, t);
  const widthAt = (t: number) => spec.baseWidth * Math.pow(1 - t, 0.75);

  const topEdge: Vec[] = [];
  const botEdge: Vec[] = [];

  const startT = 0.16;
  const endT = 0.98;
  for (let i = 0; i < spec.lobes; i++) {
    const t1 = lerp(startT, endT, (i + 0.6) / spec.lobes); // spike position (slightly forward-biased)
    const tNotch = lerp(startT, endT, (i + 1) / spec.lobes);

    const jitter = (hash(spec.seed + i * 3.7) - 0.5) * 0.15 + 1;
    const w = widthAt(t1) * jitter;
    const p = spineAt(t1);
    const tan = tanAt(t1);
    const nx = -tan.y;
    const ny = tan.x;

    // spike tip: pushed outward along the normal AND slightly forward
    // along the tangent, so each tooth reads as a chunky angled point
    // rather than a thin needle
    const spike: Vec = {
      x: p.x + nx * w + tan.x * w * 0.55,
      y: p.y + ny * w + tan.y * w * 0.55,
    };
    // notch: pulled back toward (but not onto) the spine — shallow enough
    // that the blade still reads as one solid leaf with a scalloped edge
    const notchP = spineAt(tNotch);
    const notchTan = tanAt(tNotch);
    const notchN = { x: -notchTan.y, y: notchTan.x };
    const notchW = widthAt(tNotch) * 0.4;
    const notch: Vec = { x: notchP.x + notchN.x * notchW, y: notchP.y + notchN.y * notchW };

    topEdge.push(spike);
    topEdge.push(notch);

    // mirror to the underside, offset in phase so teeth don't align
    // perfectly opposite (more organic, matches reference asymmetry)
    const t1b = lerp(startT, endT, (i + 0.35) / spec.lobes);
    const pb = spineAt(t1b);
    const tanB = tanAt(t1b);
    const nxb = -tanB.y;
    const nyb = tanB.x;
    const wb = widthAt(t1b) * jitter;
    const spikeB: Vec = {
      x: pb.x - nxb * wb + tanB.x * wb * 0.55,
      y: pb.y - nyb * wb + tanB.y * wb * 0.55,
    };
    const notchBW = widthAt(tNotch) * 0.4;
    const notchB: Vec = { x: notchP.x - notchN.x * notchBW, y: notchP.y - notchN.y * notchBW };

    botEdge.push(spikeB);
    botEdge.push(notchB);
  }

  const points: Vec[] = [crown, ...topEdge, tip, ...botEdge.reverse()];
  return points;
}

/**
 * Lays out a fan of frond specs around the crown. Angles are biased so the
 * canopy reads as one radial burst leaning toward the frame center, with a
 * couple of lower fronds drooping below the horizon of the crown — this is
 * what gives the reference art its "explosion of blades" read.
 */
function buildFrondSpecs(treeH: number, inward: 1 | -1, count: number, seedBase: number): FrondSpec[] {
  const meanAngle = -Math.PI / 2 + inward * Math.PI * 0.16; // up, biased toward center
  const sweep = Math.PI * 1.05; // wide fan, a little past horizontal on the droop side

  const specs: FrondSpec[] = [];
  let seed = seedBase;

  for (let i = 0; i < count; i++) {
    seed += 5.41;
    const tt = count > 1 ? i / (count - 1) - 0.5 : 0;
    const jitter = (hash(seed) - 0.5) * 0.1;
    const angle = meanAngle + tt * sweep + jitter;

    // fronds pointing more downward are shorter (matches how droopy old
    // fronds read smaller/lower in reference silhouettes)
    const upness = Math.max(0, Math.min(1, (Math.sin(angle) + 1) / 2));
    const length = treeH * lerp(0.5, 0.98, upness) * (0.88 + hash(seed + 1.7) * 0.28);
    const baseWidth = treeH * 0.05 * (0.8 + hash(seed + 3.1) * 0.35);
    const lobes = 6 + Math.round(hash(seed + 4.4) * 2); // 6-8 teeth per side
    const curveAmt = 0.1 + hash(seed + 6.6) * 0.12;
    const phase = hash(seed + 8.8) * Math.PI * 2;

    specs.push({ angle, length, baseWidth, lobes, curveAmt, seed, phase });
  }

  return specs;
}

// ---------------------------------------------------------------------------
// main entry point — same signature as before
// ---------------------------------------------------------------------------

export function drawSidePalmShadows(
  ctx: CanvasRenderingContext2D,
  width: number,
  timeMs: number,
  settle: number,
  energy: number,
  mobile: boolean,
  viewportH: number,
  anchor: number
): void {
  const t = timeMs / 1000;
  const calm = 1 - settle * 0.55;
  const gust = 0.5 + 0.5 * Math.sin(t * 0.24 + 1.3);
  const baseOpacity = (0.4 + 0.1 * gust) * calm * (0.7 + 0.3 * energy);

  // The palms are pinned to the viewport, not the page: `anchor` is the
  // canvas-Y of screen row 0, so a fixed screen offset lands at the same
  // spot at every scroll position. Size also scales with the viewport, so
  // the canopy is consistently large on every screen.
  const treeH = viewportH * (mobile ? 0.4 : 0.5);
  const crownY = anchor + viewportH * 0.44;
  const frondCount = mobile ? 6 : 8;
  const layers = mobile
    ? [{ scaleMul: 1, opacityMul: 1, blurLike: false }]
    : [
        { scaleMul: 1.08, opacityMul: 0.4, blurLike: true }, // soft distant shadow
        { scaleMul: 1, opacityMul: 1, blurLike: false }, // sharp near silhouette
      ];

  const trees: Array<{ xFrac: number; inward: 1 | -1; phase: number; freqMul: number; seed: number }> = [
    { xFrac: -0.04, inward: 1, phase: 0, freqMul: 1, seed: 11 },
    { xFrac: 1.04, inward: -1, phase: 2.7, freqMul: 1.12, seed: 47 },
  ];

  ctx.save();
  ctx.lineCap = 'round';

  for (const tree of trees) {
    for (const layer of layers) {
      const h = treeH * layer.scaleMul;
      const opacity = baseOpacity * layer.opacityMul;

      const swaySlow =
        Math.sin(t * 0.32 * tree.freqMul + tree.phase) * h * 0.04 * calm * (0.55 + gust * 0.85);
      // gentle whole-canopy rotation, on a slower/different beat than trunk sway
      const canopyRot =
        Math.sin(t * 0.22 * tree.freqMul + tree.phase + 1.1) * 0.035 * calm * (0.5 + gust * 0.9);

      // trunk base sits below the crown, near the shore; the water layer
      // (drawn after us) masks whatever dips below the waterline
      const base: Vec = { x: width * tree.xFrac, y: crownY + treeH };

      const trunkColor = layer.blurLike ? `rgba(8, 46, 34, ${opacity})` : `rgba(5, 34, 25, ${opacity})`;
      const frondColor = layer.blurLike ? `rgba(9, 48, 36, ${opacity})` : `rgba(4, 30, 22, ${opacity})`;

      const { crown } = drawPalmTrunk(ctx, base, h, tree.inward, tree.seed, swaySlow, trunkColor);

      const specs = buildFrondSpecs(h, tree.inward, frondCount, tree.seed);
      ctx.fillStyle = frondColor;
      for (const spec of specs) {
        // per-frond flutter: small extra rotation on its own phase, layered
        // on top of the whole-canopy sway so fronds don't move in lockstep
        const flutter = Math.sin(t * 0.9 + spec.phase) * 0.02 * calm * (0.5 + gust * 0.8);
        const pts = buildFrondBlade(crown, spec, canopyRot + flutter);
        fillPolygon(ctx, pts);
      }
    }
  }

  ctx.restore();
}
