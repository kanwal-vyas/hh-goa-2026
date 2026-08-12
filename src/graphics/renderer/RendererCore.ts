/**
 * RendererCore
 *
 * A small, dependency-free requestAnimationFrame loop manager for a single
 * canvas. This is the only thing in the graphics layer allowed to call
 * requestAnimationFrame. Nothing here imports React — the loop must be able
 * to run at 60fps regardless of what the component tree is doing.
 *
 * Responsibilities:
 *  - own the rAF loop and hand a 2D context + timing info to a draw callback
 *  - clamp devicePixelRatio (mobile especially — an uncapped DPR on a large
 *    canvas is the single biggest perf killer for this kind of ambient bg)
 *  - track a rolling frame time average and drop internal render resolution
 *    if the device is struggling, rather than dropping frames outright
 *  - pause entirely when the tab is hidden
 *  - resize cleanly on viewport / element size changes
 */

export type DrawFn = (ctx: CanvasRenderingContext2D, info: FrameInfo) => void;

export interface FrameInfo {
  width: number; // CSS pixels
  height: number; // CSS pixels
  time: number; // ms, monotonic since renderer start
  delta: number; // ms since last frame
  resolutionScale: number; // 0-1, current adaptive backing-store scale
}

const MAX_DPR_DESKTOP = 2;
const MAX_DPR_MOBILE = 1.5;
const MIN_RESOLUTION_SCALE = 0.55;
const FPS_WINDOW = 40; // frames to average before considering a downgrade
const LOW_FPS_THRESHOLD = 42;

export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
}

export class RendererCore {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private draw: DrawFn;
  private rafId = 0;
  private running = false;
  private startTime = 0;
  private lastTime = 0;
  private dpr = 1;
  private resolutionScale = 1;
  private cssWidth = 0;
  private cssHeight = 0;
  private frameTimes: number[] = [];
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, draw: DrawFn) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    this.draw = draw;

    this.handleVisibility = this.handleVisibility.bind(this);
    this.loop = this.loop.bind(this);

    this.measure();
    this.applyCanvasSize();

    this.resizeObserver = new ResizeObserver(() => {
      this.measure();
      this.applyCanvasSize();
    });
    this.resizeObserver.observe(canvas);

    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  destroy(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  private measure(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, Math.round(rect.width));
    this.cssHeight = Math.max(1, Math.round(rect.height));
    const maxDpr = isCoarsePointer() ? MAX_DPR_MOBILE : MAX_DPR_DESKTOP;
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  }

  private applyCanvasSize(): void {
    const scale = this.dpr * this.resolutionScale;
    const backingWidth = Math.max(1, Math.round(this.cssWidth * scale));
    const backingHeight = Math.max(1, Math.round(this.cssHeight * scale));
    if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
      this.canvas.width = backingWidth;
      this.canvas.height = backingHeight;
    }
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  private handleVisibility(): void {
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  }

  private trackPerformance(delta: number): void {
    // Deltas far above a normal frame budget mean the browser throttled the
    // tab (backgrounded / preview pane) — that's not our draw cost. Ignore
    // those frames so a throttled tab never degrades the render resolution.
    if (delta > 120) return;
    this.frameTimes.push(delta);
    if (this.frameTimes.length < FPS_WINDOW) return;

    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const fps = 1000 / avg;
    this.frameTimes = [];

    if (fps < LOW_FPS_THRESHOLD && this.resolutionScale > MIN_RESOLUTION_SCALE) {
      this.resolutionScale = Math.max(MIN_RESOLUTION_SCALE, this.resolutionScale - 0.15);
      this.applyCanvasSize();
    }
  }

  private loop(now: number): void {
    if (!this.running) return;
    const delta = now - this.lastTime;
    this.lastTime = now;

    this.ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    this.draw(this.ctx, {
      width: this.cssWidth,
      height: this.cssHeight,
      time: now - this.startTime,
      delta,
      resolutionScale: this.resolutionScale,
    });

    this.trackPerformance(delta);
    this.rafId = requestAnimationFrame(this.loop);
  }
}
