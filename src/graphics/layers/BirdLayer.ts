/**
 * BirdLayer — a living flock of distant birds for the Goa environment.
 *
 * The birds are tiny procedural silhouettes (no images, no emoji, no DOM),
 * drawn on the shared environment canvas and driven inside the single
 * RendererCore rAF loop. Their motion is deliberately lightweight and
 * atmospheric:
 *
 *   base trajectory + individual phase + wind + flock cohesion
 *   + gentle separation + cursor disturbance
 *
 * Everything is deterministic: the flock is created from the environment's
 * seeded rng, and the simulation uses only time-based functions — no
 * per-frame randomness. Birds live in *viewport* fraction space and are
 * pinned to the upper sky, so the flock follows the user through the hero
 * into the How-It-Works section like part of the air.
 *
 * Depth (0 far → 1 near) shapes size, opacity, speed and how strongly a
 * bird reacts to the cursor. The cursor is a disturbance in the
 * environment, not a game: birds drift along organic paths, gently part
 * when the pointer gets close, and gradually recover.
 */

const TWO_PI = Math.PI * 2;

/** Cursor position in -1..1 canvas space (as LiveEnvironment receives it). */
export interface BirdFlockUpdate {
  width: number; // canvas CSS px
  viewportHeight: number; // viewport CSS px
  anchorY: number; // canvas-y of the current viewport top (scrollY - canvasTopInDoc)
  timeMs: number;
  delta: number;
  settle: number; // 0 loose → 1 locked (stage-driven)
  energy: number; // 0 calm → 1 charged (stage-driven)
  pointerX: number;
  pointerY: number;
}

interface Bird {
  x: number; // viewport fraction 0..1
  y: number; // viewport fraction 0..1 (top = 0)
  vx: number; // viewport fractions per second
  vy: number;
  size: number; // base px at a 900px-tall viewport
  opacity: number;
  depth: number; // 0 far .. 1 near
  variant: number; // 0..3 silhouette
  flock: number; // which sub-flock
  homeX: number;
  homeY: number;
  baseAngle: number;
  baseSpeed: number; // viewport fractions per second
  phase: number;
  flapPhase: number;
  flapSpeed: number;
  disturb: number; // current cursor disturbance 0..1, decays
}

/** Each sub-flock gets its own region of sky and a prevailing drift. */
const FLOCK_SKY_X: ReadonlyArray<[number, number]> = [
  [0.03, 0.42],
  [0.5, 0.97],
  [0.2, 0.8],
];
const FLOCK_SKY_Y: ReadonlyArray<[number, number]> = [
  [0.02, 0.28],
  [0.02, 0.3],
  [0.06, 0.4],
];
const FLOCK_DRIFT: ReadonlyArray<number> = [0.08, Math.PI - 0.1, 0.55];

const DEPTH_CLASSES: Array<{ mid: number; spread: number; count: number }> = [
  { mid: 0.15, spread: 0.12, count: 12 },
  { mid: 0.5, spread: 0.16, count: 7 },
  { mid: 0.85, spread: 0.13, count: 4 },
];

const MOBILE_DEPTH_CLASSES: Array<{ mid: number; spread: number; count: number }> = [
  { mid: 0.15, spread: 0.12, count: 6 },
  { mid: 0.5, spread: 0.16, count: 4 },
  { mid: 0.85, spread: 0.13, count: 2 },
];

export class BirdFlock {
  private birds: Bird[] = [];
  private centers: Array<{ x: number; y: number }> = [];
  private flockCount = 3;
  private windPhase: number;

  constructor(rng: () => number, mobile: boolean) {
    this.windPhase = rng() * TWO_PI;
    this.flockCount = FLOCK_DRIFT.length;
    this.centers = Array.from({ length: this.flockCount }, () => ({ x: 0, y: 0 }));

    const classes = mobile ? MOBILE_DEPTH_CLASSES : DEPTH_CLASSES;
    for (const c of classes) {
      for (let i = 0; i < c.count; i++) {
        const depth = Math.min(1, Math.max(0.05, c.mid + (rng() - 0.5) * c.spread));
        const flock = Math.floor(rng() * this.flockCount);
        const skyX = FLOCK_SKY_X[flock];
        const skyY = FLOCK_SKY_Y[flock];
        const homeX = skyX[0] + rng() * (skyX[1] - skyX[0]);
        // nearer birds can sit a touch lower — they occasionally drift
        // behind the hero typography
        const homeY = skyY[0] + rng() * (skyY[1] - skyY[0]) + depth * 0.06;
        const baseAngle = FLOCK_DRIFT[flock] + (rng() - 0.5) * 0.6;
        const baseSpeed = (0.006 + depth * 0.016) * (0.8 + rng() * 0.4);
        const x = homeX + (rng() - 0.5) * 0.14;
        const y = homeY + (rng() - 0.5) * 0.06;
        this.birds.push({
          x,
          y,
          vx: Math.cos(baseAngle) * baseSpeed,
          vy: Math.sin(baseAngle) * baseSpeed,
          size: (2.1 + depth * 6.4) * (0.8 + rng() * 0.4),
          opacity: Math.min(0.85, 0.28 + depth * 0.55) * (0.85 + rng() * 0.3),
          depth,
          variant: Math.floor(rng() * 4),
          flock,
          homeX,
          homeY,
          baseAngle,
          baseSpeed,
          phase: rng() * TWO_PI,
          flapPhase: rng() * TWO_PI,
          flapSpeed: 2.6 + rng() * 3.2,
          disturb: 0,
        });
      }
    }
  }

  /** Advance the flock. Pure state mutation — no React, no DOM, cheap. */
  update(p: BirdFlockUpdate): void {
    if (p.delta <= 0) return;
    const dt = Math.min(0.05, p.delta / 1000);
    const t = p.timeMs / 1000;

    // stage-driven mood — atmospheric, never theatrical
    const speedMul = 0.7 + p.energy * 0.7;
    const cohesion = 0.2 + p.settle * 0.85;
    const direction = p.energy * 0.4;

    // slow shared wind
    const windX = Math.sin(t * 0.1 + this.windPhase) * 0.0011;
    const windY = Math.cos(t * 0.085 + this.windPhase * 1.7) * 0.0008;

    // flock centers (cheap: a few birds per flock)
    for (let f = 0; f < this.flockCount; f++) {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (const b of this.birds) {
        if (b.flock !== f) continue;
        sx += b.x;
        sy += b.y;
        n++;
      }
      const c = this.centers[f];
      c.x = n ? sx / n : 0.5;
      c.y = n ? sy / n : 0.3;
    }

    const pcx = (p.pointerX + 1) / 2;
    const pcy = (p.pointerY + 1) / 2;

    for (const b of this.birds) {
      // organic wander — a slow sine plus a very slow one, so paths curve
      // and occasionally reverse direction on their own
      const wander =
        Math.sin(t * 0.045 + b.phase) * 0.6 + Math.sin(t * 0.012 + b.phase * 2.1) * 0.4;
      const wantAngle = b.baseAngle + wander;
      let sx = Math.cos(wantAngle) * 0.3;
      let sy = Math.sin(wantAngle) * 0.3;

      sx += windX * 20;
      sy += windY * 20;

      const fc = this.centers[b.flock];
      sx += (fc.x - b.x) * cohesion * 0.16;
      sy += (fc.y - b.y) * cohesion * 0.13;

      // directional drift — stronger when the environment is charged
      sx += Math.cos(b.baseAngle) * direction;
      sy += Math.sin(b.baseAngle) * direction;

      // gentle separation from nearby birds
      for (const o of this.birds) {
        if (o === b) continue;
        const dx = b.x - o.x;
        const dy = b.y - o.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 0.0011 && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = (0.033 - d) * 0.5;
          sx += (dx / d) * push;
          sy += (dy / d) * push;
        }
      }

      // cursor — a disturbance, not a game. Nearer birds react more.
      const reaction = 0.2 + b.depth * 0.9;
      const radius = 0.16 + b.depth * 0.09;
      const cdx = b.x - pcx;
      const cdy = b.y - pcy;
      const cd = Math.hypot(cdx, cdy);
      if (cd < radius && cd > 1e-5) {
        const strength = (1 - cd / radius) * reaction;
        sx += (cdx / cd) * strength * 0.9;
        sy += (cdy / cd) * strength * 0.9;
        b.disturb = Math.min(1, b.disturb + strength * 0.6);
      }

      // keep the flock in the sky — soft containment so it never sinks
      // into the water or drifts out the top
      const skyBottom = 0.55 + b.depth * 0.1;
      if (b.y > skyBottom) sy -= (b.y - skyBottom) * 0.5;
      if (b.y < 0.012) sy += (0.012 - b.y) * 0.9;

      // integrate with momentum and a soft speed envelope — scattered
      // birds briefly fly a little faster, then settle back
      b.vx += sx * dt * 2.2;
      b.vy += sy * dt * 2.2;
      const sp = Math.hypot(b.vx, b.vy);
      const maxV = b.baseSpeed * speedMul * (1 + b.disturb * 0.8);
      const minV = maxV * 0.45;
      if (sp > maxV) {
        b.vx *= maxV / sp;
        b.vy *= maxV / sp;
      } else if (sp > 0 && sp < minV) {
        b.vx *= minV / sp;
        b.vy *= minV / sp;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.disturb *= Math.exp(-1.9 * dt);

      // horizontal wrap — distant flocks keep crossing the sky
      if (b.x > 1.18) {
        b.x = -0.18;
        b.y = b.homeY + Math.sin(b.phase) * 0.05;
      } else if (b.x < -0.18) {
        b.x = 1.18;
        b.y = b.homeY + Math.sin(b.phase) * 0.05;
      }
    }
  }

  /** Draw the flock, mapped from viewport space onto the canvas. */
  draw(
    ctx: CanvasRenderingContext2D,
    width: number,
    viewportHeight: number,
    anchorY: number,
    timeMs: number,
    reducedMotion: boolean
  ): void {
    const t = timeMs / 1000;
    const scale = viewportHeight / 900;
    ctx.save();
    for (const b of this.birds) {
      const x = b.x * width;
      const y = anchorY + b.y * viewportHeight;
      const s = Math.max(1.1, b.size * scale);
      // reduced motion: still wings, still the same sky
      const flap = reducedMotion ? 0.35 : Math.sin(t * b.flapSpeed + b.flapPhase);
      ctx.fillStyle = `rgba(6, 24, 17, ${b.opacity.toFixed(3)})`;
      // the swallow silhouette has a nose — face the direction of travel
      ctx.save();
      ctx.translate(x, y);
      if (b.vx < 0) ctx.scale(-1, 1);
      drawBird(ctx, 0, 0, s, flap, b.variant);
      ctx.restore();
    }
    ctx.restore();
  }
}

/**
 * Draw one bird. x/y is the center, s the depth-scaled size. flap is the
 * shared wing-beat in [-1, 1]; variant picks one of 4 silhouette shapes so
 * the flock doesn't look like one icon pasted 30 times.
 */
function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  flap: number,
  variant: number
): void {
  const sweep = [1, 1.18, 0.82, 0.96][variant]; // wing reach (back-swept)
  const lift = [0.5, 0.56, 0.36, 0.44][variant]; // wing height at full beat
  const bodyLen = [0.8, 0.68, 0.98, 0.86][variant]; // body + tail reach
  // both wings beat together; flap in [-1, 1] — 0.4..1.0 sweep of lift
  const wingFactor = 0.4 + 0.6 * (flap * 0.5 + 0.5);
  const wl = lift * wingFactor;

  ctx.save();
  ctx.translate(x, y);

  // Angular "swallow" silhouette: a beak point at the front, each wing swept
  // back to a sharp tip, with a stepped notch cut in near the tail (the
  // signature zigzag from the reference photo) instead of a smooth curve.
  ctx.beginPath();
  // nose / beak
  ctx.moveTo(s * bodyLen * 0.45, 0);
  // right wing: leading edge out to the tip
  ctx.lineTo(s * sweep * 0.5, -s * wl * 0.35);
  ctx.lineTo(s * sweep, -s * wl);
  // stepped notch back in toward the tail (the angular "step" in the ref image)
  ctx.lineTo(s * sweep * 0.55, -s * wl * 0.3);
  ctx.lineTo(s * bodyLen * 0.3, -s * 0.06);
  // tail tip
  ctx.lineTo(s * bodyLen * 0.15, s * 0.04);
  // left wing: mirror of the right, tail to tip to notch back to nose
  ctx.lineTo(-s * bodyLen * 0.3, -s * 0.06);
  ctx.lineTo(-s * sweep * 0.55, -s * wl * 0.3);
  ctx.lineTo(-s * sweep, -s * wl);
  ctx.lineTo(-s * sweep * 0.5, -s * wl * 0.35);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/** Create a deterministic flock from the environment's seeded rng. */
export function createBirdFlock(rng: () => number, mobile: boolean): BirdFlock {
  return new BirdFlock(rng, mobile);
}
