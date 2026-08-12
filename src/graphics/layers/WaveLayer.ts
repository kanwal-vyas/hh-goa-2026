/**
 * WaveLayer — water, not bands.
 *
 * The scene's water body fills from a viewport-pinned waterline down to the
 * bottom of the canvas: a deep blue-green mass with a set of independent,
 * overlapping crest faces fading downward into it. Crests sit at different
 * heights, run at different speeds/amplitudes, and each carries a slow swell
 * envelope so the surface never looks mathematically repetitive. Foam travels
 * along each crest, a thin stroke-only wave crosses the field, and the sun's
 * reflection smears across the water near the sun's position.
 *
 * Temporal hierarchy lives here too: foam/glints move fastest, crest travel
 * is medium, swells are slow.
 *
 * `settle` calms but never kills the water (GENERATED still breathes);
 * `energy` charges it (GENERATING runs hotter than INTRO); `surge` is the
 * one-shot ripple when the photo lands or generation kicks off.
 */

export interface LayerSeed {
  phase: number; // 0-2π, offsets crest phase per builder seed
  amplitude: number; // 0.7-1.3 relative amplitude multiplier
  flow: number; // 0.75-1.25 horizontal flow speed multiplier
}

const TWO_PI = Math.PI * 2;

/**
 * Composite-sine crest. The `- t * k` terms make crests travel horizontally
 * (flow), so the water moves, not wobbles.
 */
function crestY(x: number, width: number, t: number, phase: number, amp: number): number {
  const nx = x / width;
  const a = Math.sin(nx * TWO_PI * 1.35 - t * 1.0 + phase) * 0.42;
  const b = Math.sin(nx * TWO_PI * 2.75 - t * 1.7 + phase * 2) * 0.26;
  const c = Math.sin(nx * TWO_PI * 0.62 - t * 0.5 + phase * 0.5) * 0.32;
  return (a + b + c) * amp;
}

interface Crest {
  baseFrac: number; // baseline position within the water zone (0 = top of water)
  ampMult: number;
  speedMult: number;
  thickness: number; // wave-face thickness as a fraction of the water zone height
  color: [number, number, number];
  fillAlpha: number;
  foam: number; // foam stroke alpha at full energy
  foamWidth: number;
}

/** Drawn back → front: deeper crests first, shallower (closer) crests over them. */
const CRESTS: Crest[] = [
  { baseFrac: 0.58, ampMult: 1.15, speedMult: 0.7, thickness: 0.5, color: [10, 62, 84], fillAlpha: 0.55, foam: 0.07, foamWidth: 1.4 },
  { baseFrac: 0.4, ampMult: 1.0, speedMult: 0.95, thickness: 0.34, color: [20, 122, 148], fillAlpha: 0.48, foam: 0.15, foamWidth: 1.7 },
  { baseFrac: 0.22, ampMult: 0.85, speedMult: 1.25, thickness: 0.24, color: [38, 176, 172], fillAlpha: 0.46, foam: 0.28, foamWidth: 2 },
  { baseFrac: 0.07, ampMult: 0.7, speedMult: 1.5, thickness: 0.12, color: [66, 204, 190], fillAlpha: 0.42, foam: 0.4, foamWidth: 2.2 },
];

export function drawWaveLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeMs: number,
  settle: number,
  energy: number,
  surge: number,
  seed: LayerSeed,
  mobile: boolean,
  sunFrac: number,
  waterTop: number,
  viewportH: number
): void {
  const zone = Math.max(1, height - waterTop);
  const step = Math.max(7, Math.round(width / (mobile ? 52 : 110)));

  const ampFactor = (0.35 + 0.65 * energy) * (1 - settle * 0.5) * (1 + surge * 0.5);
  const speedFactor = (0.4 + 0.6 * energy) * (1 - settle * 0.4) * (1 + surge * 0.3);
  // amplitude scales with the viewport so the sea is alive on every screen
  const ampBase = Math.max(40, viewportH * 0.09);

  ctx.save();

  // ---- deep water mass: bright blue-green depth below everything ----
  const mass = ctx.createLinearGradient(0, waterTop, 0, height);
  mass.addColorStop(0, `rgba(16, 92, 116, ${0.58 * (1 - settle * 0.15)})`);
  mass.addColorStop(0.45, `rgba(12, 68, 96, ${0.88 * (1 - settle * 0.1)})`);
  mass.addColorStop(1, 'rgba(8, 46, 66, 0.96)');
  ctx.fillStyle = mass;
  ctx.fillRect(0, waterTop, width, height - waterTop);

  for (let ci = 0; ci < CRESTS.length; ci++) {
    const crest = CRESTS[ci];
    const baseY = waterTop + zone * crest.baseFrac;
    const t = timeMs * 0.0005 * speedFactor * crest.speedMult * seed.flow;
    // slow swell envelope — each crest breathes at its own rate
    const swell = 1 + 0.3 * Math.sin(timeMs * 0.00013 * (1 + ci * 0.17) + seed.phase * 1.7);
    const amp = ampBase * crest.ampMult * seed.amplitude * ampFactor * swell;
    const d = zone * crest.thickness;

    // ---- fading wave face: strong at the crest, dissolving downward ----
    const face = ctx.createLinearGradient(0, baseY - amp, 0, baseY + amp + d);
    const [r, g, b] = crest.color;
    face.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${crest.fillAlpha * (1 - settle * 0.25)})`);
    face.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.beginPath();
    ctx.moveTo(0, baseY + crestY(0, width, t, seed.phase, amp));
    for (let x = step; x <= width; x += step) {
      ctx.lineTo(x, baseY + crestY(x, width, t, seed.phase, amp));
    }
    // bottom edge wavers independently (different phase) so the face is organic
    ctx.lineTo(width, baseY + crestY(width, width, t, seed.phase + 0.7, amp) + d);
    for (let x = width - step; x >= 0; x -= step) {
      ctx.lineTo(x, baseY + crestY(x, width, t, seed.phase + 0.7, amp) + d);
    }
    ctx.closePath();
    ctx.fillStyle = face;
    ctx.fill();

    // ---- foam travelling along the crest ----
    const foamAlpha = crest.foam * (0.45 + 0.55 * energy) * (1 - settle * 0.45);
    ctx.beginPath();
    ctx.moveTo(0, baseY + crestY(0, width, t, seed.phase, amp));
    for (let x = step; x <= width; x += step) {
      ctx.lineTo(x, baseY + crestY(x, width, t, seed.phase, amp));
    }
    ctx.strokeStyle = `rgba(222, 250, 238, ${foamAlpha})`;
    ctx.lineWidth = crest.foamWidth;
    ctx.setLineDash([6, 15]);
    ctx.lineDashOffset = -(((t * 62) % 21) + 21) % 21;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---- one thin overlapping wave stroke crossing the field ----
  const crossT = timeMs * 0.0005 * speedFactor * 1.1 * seed.flow;
  const crossBase = waterTop + zone * 0.3;
  const crossAmp = ampBase * 0.5 * seed.amplitude * ampFactor * (1 + 0.25 * Math.sin(timeMs * 0.0001 + seed.phase));
  ctx.beginPath();
  ctx.moveTo(0, crossBase + crestY(0, width, crossT, seed.phase + 3.1, crossAmp));
  for (let x = step; x <= width; x += step) {
    ctx.lineTo(x, crossBase + crestY(x, width, crossT, seed.phase + 3.1, crossAmp));
  }
  ctx.strokeStyle = `rgba(140, 228, 218, ${0.32 * (0.4 + 0.6 * energy) * (1 - settle * 0.4)})`;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // ---- sun glints drifting on the front crest (skip on coarse pointers) ----
  if (!mobile) {
    const front = CRESTS[CRESTS.length - 1];
    const frontBase = waterTop + zone * front.baseFrac;
    const frontT = timeMs * 0.0005 * speedFactor * front.speedMult * seed.flow;
    const frontAmp = ampBase * front.ampMult * seed.amplitude * ampFactor * (1 + 0.3 * Math.sin(timeMs * 0.00013 * 1.51 + seed.phase * 1.7));
    const glintCount = Math.max(3, Math.round(width / 320));
    for (let i = 0; i < glintCount; i++) {
      const travel = (((frontT * 0.55 + i / glintCount) % 1) + 1) % 1;
      const gx = travel * width;
      const gy = frontBase + crestY(gx, width, frontT, seed.phase, frontAmp) + 4;
      const bob = Math.sin(frontT * 2.2 + i * 2.1) * 2.4;
      const pulse = 0.5 + 0.5 * Math.sin(frontT * 1.6 + i * 3.3);
      ctx.beginPath();
      ctx.ellipse(gx, gy + bob, 14 + (i % 3) * 6, 2.4, 0, 0, TWO_PI);
      ctx.fillStyle = `rgba(190, 244, 230, ${0.08 + 0.15 * pulse * (1 - settle * 0.5)})`;
      ctx.fill();
    }
  }

  // ---- reflected sunlight: a warm smear on the water near the sun ----
  const reflT = timeMs * 0.0003;
  const rx = width * sunFrac + Math.sin(reflT * 0.8) * width * 0.04;
  const ry = waterTop + zone * 0.3 + Math.sin(reflT * 1.3 + 2) * 10;
  const reflPulse = 0.5 + 0.5 * Math.sin(reflT * 1.1);
  const reflR = Math.min(width * 0.3, zone * 0.3);
  const refl = ctx.createRadialGradient(rx, ry, 0, rx, ry, reflR);
  const reflA = (0.12 + 0.08 * reflPulse) * (0.5 + 0.5 * energy) * (1 - settle * 0.4);
  refl.addColorStop(0, `rgba(255, 208, 128, ${reflA})`);
  refl.addColorStop(1, 'rgba(255, 208, 128, 0)');
  ctx.fillStyle = refl;
  ctx.beginPath();
  ctx.ellipse(rx, ry, reflR, reflR * 0.16, 0, 0, TWO_PI);
  ctx.fill();

  ctx.restore();
}
