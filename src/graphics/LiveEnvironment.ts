/**
 * LiveEnvironment
 *
 * The single entry point React talks to. It owns a RendererCore + the
 * environmental layers, and exposes an imperative API (setStage/setSeed/
 * setPointer/destroy) — no props, no re-renders. React calls setStage()
 * perhaps five times in an entire session; everything in between is this
 * object's own business, running on its own rAF loop.
 *
 * The scene is one continuous environment: the canvas spans the hero and
 * the compose section, painting the base tropical green itself, then layering
 * palm shadows, sunlight and finally the ocean. The ocean is anchored to the
 * lower viewport — the waterline stays in view at every scroll position, so
 * the sea always reads as "behind the interface" rather than hiding below
 * the fold. The layers are tuned to merge into one atmosphere — the goal is
 * "a summer afternoon", not "the sun layer over the wave layer".
 *
 * The environment responds to the state machine through three lerped
 * parameters rather than snapping, so transitions read as the environment
 * *reacting*:
 *
 *  - settle (0 loose → 1 locked): ORGANIZE gathers the composition.
 *  - energy (0 calm → 1 charged): GENERATING runs hotter than INTRO.
 *  - surge (0 → 1, decays): a one-shot ripple when the photo lands and
 *    when generation kicks off — the water visibly reacts to the user.
 *
 * Stage character:
 *  INTRO           loose + sunny (settle 0,     energy 0.5)
 *  PHOTO_UPLOADED  loose + a ripple surge       (settle 0,     energy 0.72)
 *  DETAILS_ENTERED beginning to organize        (settle 0.2,   energy 0.55)
 *  GENERATING      environment charges up       (settle 0.12,  energy 1.0)
 *  GENERATED       calm but breathing — locked  (settle 0.75,  energy 0.35)
 */

import { RendererCore, isCoarsePointer } from './renderer/RendererCore';
import { drawWaveLayer, type LayerSeed } from './layers/WaveLayer';
import { drawSunLightLayer, type SunSeed } from './layers/SunLightLayer';
import {
  drawDappledLightLayer,
  drawSidePalmShadows,
  createDappleFans,
  type DappleFan,
} from './layers/DappledLightLayer';
import { createBirdFlock, type BirdFlock } from './layers/BirdLayer';
import { createRng } from '../utils/seed';
import type { Stage } from '../state/experienceState';

const TWO_PI = Math.PI * 2;

const SETTLE_TARGETS: Record<Stage, number> = {
  INTRO: 0,
  PHOTO_UPLOADED: 0,
  DETAILS_ENTERED: 0.2,
  GENERATING: 0.12,
  GENERATED: 0.75,
};

const ENERGY_TARGETS: Record<Stage, number> = {
  INTRO: 0.5,
  PHOTO_UPLOADED: 0.72,
  DETAILS_ENTERED: 0.55,
  GENERATING: 1,
  GENERATED: 0.35,
};

/** Stages whose arrival sends a one-shot ripple through the environment. */
const SURGE_TRIGGERS: Partial<Record<Stage, number>> = {
  PHOTO_UPLOADED: 1,
  GENERATING: 0.55,
};

const SETTLE_LERP_SPEED = 0.0022; // per ms
const ENERGY_LERP_SPEED = 0.0017; // per ms
const SURGE_DECAY = 0.0011; // per ms — ripple dies off over ~2s

/** The ocean's horizon sits this fraction down the current viewport. */
const WATERLINE_VIEWPORT_FRAC = 0.68;

export class LiveEnvironment {
  private renderer: RendererCore | null = null;
  private waveSeed: LayerSeed;
  private sunSeed: SunSeed;
  private palmPhase: number;
  private dappleFans: DappleFan[];
  private birdFlock: BirdFlock;
  private settleCurrent = 0;
  private settleTarget = 0;
  private energyCurrent = 0.5;
  private energyTarget = 0.5;
  private surge = 0;
  private pointerX = 0;
  private pointerY = 0;
  private mobile: boolean;
  private reducedMotion: boolean;
  private scrollY = 0;
  private viewportH = 800;
  private canvasTopInDoc = 0;
  private canvas: HTMLCanvasElement | null = null;
  private disposers: Array<() => void> = [];

  constructor(seedString = 'frame-in-goa-default') {
    const rng = createRng(seedString);
    this.waveSeed = {
      phase: rng() * TWO_PI,
      amplitude: 0.85 + rng() * 0.3,
      flow: 0.75 + rng() * 0.5,
    };
    this.sunSeed = {
      cx: 0.42 + rng() * 0.16,
      cy: 0.3 + rng() * 0.1,
      phase: rng() * TWO_PI,
    };
    this.palmPhase = rng() * TWO_PI;
    this.dappleFans = createDappleFans(rng);
    this.mobile = isCoarsePointer();
    this.birdFlock = createBirdFlock(rng, this.mobile);
    this.reducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.measureViewport();

    const onScroll = () => {
      this.scrollY = window.scrollY;
    };
    const onResize = () => {
      this.measureViewport();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    this.disposers.push(() => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    });

    this.renderer = new RendererCore(canvas, (ctx, info) => this.render(ctx, info));
    this.renderer.start();
  }

  private measureViewport(): void {
    this.viewportH = window.innerHeight || 800;
    this.scrollY = window.scrollY;
    if (this.canvas) {
      this.canvasTopInDoc = this.canvas.getBoundingClientRect().top + window.scrollY;
    }
  }

  setStage(stage: Stage): void {
    this.settleTarget = SETTLE_TARGETS[stage];
    this.energyTarget = ENERGY_TARGETS[stage];
    const surge = SURGE_TRIGGERS[stage];
    if (surge) this.surge = Math.min(1, this.surge + surge);
  }

  /** Cursor in -1..1 space: sun leans toward it, water bends slightly. */
  setPointer(x: number, y: number): void {
    if (this.reducedMotion) return;
    this.pointerX = Math.max(-1, Math.min(1, x));
    this.pointerY = Math.max(-1, Math.min(1, y));
  }

  /** Re-seed all layers deterministically — used once real generation input exists. */
  setSeed(seedString: string): void {
    const rng = createRng(seedString);
    this.waveSeed = {
      phase: rng() * TWO_PI,
      amplitude: 0.85 + rng() * 0.3,
      flow: 0.75 + rng() * 0.5,
    };
    this.sunSeed = {
      cx: 0.42 + rng() * 0.16,
      cy: 0.3 + rng() * 0.1,
      phase: rng() * TWO_PI,
    };
    this.palmPhase = rng() * TWO_PI;
    this.dappleFans = createDappleFans(rng);
    this.birdFlock = createBirdFlock(rng, this.mobile);
  }

  destroy(): void {
    this.renderer?.destroy();
    this.renderer = null;
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
  }

  private render(
    ctx: CanvasRenderingContext2D,
    info: { width: number; height: number; time: number; delta: number }
  ): void {
    if (this.reducedMotion) {
      // Static composition — no animation, state still honoured.
      this.settleCurrent = this.settleTarget;
      this.energyCurrent = this.energyTarget;
      this.surge = 0;
      this.pointerX = 0;
      this.pointerY = 0;
    } else {
      this.settleCurrent +=
        (this.settleTarget - this.settleCurrent) * Math.min(1, SETTLE_LERP_SPEED * info.delta);
      this.energyCurrent +=
        (this.energyTarget - this.energyCurrent) * Math.min(1, ENERGY_LERP_SPEED * info.delta);
      this.surge *= Math.exp(-SURGE_DECAY * info.delta);
    }

    const time = this.reducedMotion ? 0 : info.time;
    const settle = this.settleCurrent;
    const energy = this.energyCurrent;
    const surge = this.surge;
    const w = info.width;
    const h = info.height;

    // ---- ocean horizon: pinned to the lower viewport, so the sea is
    // always visible behind the interface at any scroll position ----
    const waterTop = Math.min(
      Math.max(this.scrollY + this.viewportH * WATERLINE_VIEWPORT_FRAC - this.canvasTopInDoc, h * 0.14),
      h * 0.95
    );

    // ---- base: bright tropical green land — 2pm Goa, not dusk ----
    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#1b6a4c');
    base.addColorStop(0.55, '#135139');
    base.addColorStop(1, '#0d3b2c');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    drawDappledLightLayer(ctx, w, time, settle, energy, this.dappleFans, waterTop);
    // anchor = canvas-Y of screen row 0, so the palms are pinned to the
    // viewport and never drift with scroll
    const viewportAnchor = this.scrollY - this.canvasTopInDoc;
    drawSidePalmShadows(ctx, w, time, settle, energy, this.mobile, this.viewportH, viewportAnchor);
    drawSunLightLayer(
      ctx,
      w,
      h,
      time,
      settle,
      energy,
      surge,
      this.sunSeed,
      this.pointerX,
      this.pointerY,
      waterTop
    );
    // a distant flock lives in the sky — same single loop, no extra
    // requestAnimationFrame, no React, no DOM. It follows the viewport so
    // the air feels continuous from the hero through the sections below.
    if (!this.reducedMotion) {
      this.birdFlock.update({
        width: w,
        viewportHeight: this.viewportH,
        anchorY: viewportAnchor,
        timeMs: info.time,
        delta: info.delta,
        settle,
        energy,
        pointerX: this.pointerX,
        pointerY: this.pointerY,
      });
    }
    this.birdFlock.draw(ctx, w, this.viewportH, viewportAnchor, time, this.reducedMotion);
    drawPalmSilhouettes(ctx, w, h, time, settle, this.palmPhase, this.mobile);
    drawWaveLayer(
      ctx,
      w,
      h,
      time,
      settle,
      energy,
      surge,
      this.waveSeed,
      this.mobile,
      this.sunSeed.cx + this.pointerX * 0.03,
      waterTop,
      this.viewportH
    );
  }
}

/**
 * Dark palm silhouettes at the bottom corners — the beach edge behind the
 * water. They sway very slowly (sunlight-through-trees logic), giving the
 * composition depth above the shoreline without a single extra loop.
 */
function drawPalmSilhouettes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeMs: number,
  settle: number,
  phase: number,
  mobile: boolean
): void {
  const t = timeMs * 0.00045;
  const sway = (1 - settle * 0.5) * (mobile ? 0.7 : 1);
  const treeHeight = Math.min(width, height) * (mobile ? 0.11 : 0.15);

  ctx.save();
  ctx.strokeStyle = 'rgba(4, 22, 16, 0.92)';
  ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(4, 22, 16, 0.92)';

  const trees: Array<{ x: number; scale: number; ph: number }> = [
    { x: width * 0.06, scale: 1, ph: phase },
    { x: width * 0.94, scale: 0.82, ph: phase + 2.1 },
  ];

  for (const tree of trees) {
    if (mobile && tree.x > width * 0.5) continue; // one tree on small screens
    drawPalm(ctx, tree.x, height + treeHeight * 0.25, treeHeight * tree.scale, t, sway, tree.ph);
  }

  ctx.restore();
}

function drawPalm(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  h: number,
  t: number,
  sway: number,
  phase: number
): void {
  const bend = Math.sin(t * 0.5 + phase) * h * 0.05 * sway;

  // trunk — a slight arc, tapering
  ctx.lineWidth = h * 0.055;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + h * 0.06, baseY - h * 0.55, x + h * 0.15 + bend, baseY - h);
  ctx.stroke();

  // frond fan from the crown
  const tx = x + h * 0.15 + bend;
  const ty = baseY - h;
  const fronds = 6;
  for (let i = 0; i < fronds; i++) {
    const f = i / (fronds - 1) - 0.5;
    const ang = f * 2.1 + Math.sin(t * 0.35 + phase + i) * 0.025 * sway;
    const fl = h * (0.36 + 0.1 * Math.cos(f * Math.PI));
    const ex = tx + Math.cos(ang) * fl * 1.6;
    const ey = ty + Math.sin(ang) * fl * 0.85 - h * 0.05;
    ctx.lineWidth = h * 0.045;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(
      tx + Math.cos(ang) * fl * 0.8,
      ty + Math.sin(ang) * fl * 0.65 - h * 0.04,
      ex,
      ey
    );
    ctx.stroke();
  }
}
