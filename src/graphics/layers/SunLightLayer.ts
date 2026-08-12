/**
 * SunLightLayer — 2pm Goa heat as light, not a sun icon.
 *
 * Four slow movements build the atmosphere:
 *  - a broad warm glow (large and soft — never a hard disc), anchored to the
 *    sky above the waterline
 *  - two long painted light shafts that rotate imperceptibly slowly,
 *    standing in for irregular sunlight through the air
 *  - a very slow ocean-blue atmospheric wash drifting across the whole
 *    scene, so blue is air, not decoration
 *  - a cool cyan upwash rising from the water, i.e. the ocean's reflected
 *    light in the lower atmosphere
 *
 * `settle` gathers the light; `energy` charges it; `surge` is the one-shot
 * flash when the photo lands; pointer nudges the sun gently toward the
 * cursor so the environment feels present.
 */

export interface SunSeed {
  cx: number; // 0-1 horizontal anchor
  cy: number; // 0-1 vertical anchor within the sky band (above the waterline)
  phase: number;
}

function drawShaft(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  angle: number,
  length: number,
  halfWidth: number,
  color: [number, number, number],
  alpha: number
): void {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = -dy;
  const py = dx;
  const tipX = x0 + dx * length;
  const tipY = y0 + dy * length;
  const tipW = halfWidth * 0.18;

  const grad = ctx.createLinearGradient(x0, y0, tipX, tipY);
  grad.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`);
  grad.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);

  ctx.beginPath();
  ctx.moveTo(x0 + px * halfWidth, y0 + py * halfWidth);
  ctx.lineTo(tipX + px * tipW, tipY + py * tipW);
  ctx.lineTo(tipX - px * tipW, tipY - py * tipW);
  ctx.lineTo(x0 - px * halfWidth, y0 - py * halfWidth);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
}

export function drawSunLightLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeMs: number,
  settle: number,
  energy: number,
  surge: number,
  seed: SunSeed,
  pointerX: number,
  pointerY: number,
  waterTop: number
): void {
  const t = timeMs * 0.00055; // medium — breathing
  const verySlow = timeMs * 0.000035; // very slow — atmosphere
  const breathe = Math.sin(t + seed.phase) * 0.5 + 0.5;
  const energyK = (0.7 + 0.3 * energy) * (1 + surge * 0.3);

  // sun sits in the sky — the green band above the waterline — and leans
  // toward the cursor
  const sunX = width * (seed.cx + pointerX * 0.03) + Math.sin(verySlow * 2.7 + seed.phase) * width * 0.02;
  const sunY =
    waterTop * (0.3 + seed.cy * 0.25 + pointerY * 0.02) +
    Math.cos(verySlow * 2.1 + seed.phase) * waterTop * 0.02;

  ctx.save();

  // ---- broad warm light — large, soft, no disc edge ----
  const radius = Math.min(width, height) * (0.78 - settle * 0.14) * (1 + breathe * 0.05);
  const opacity = (0.3 + breathe * 0.1) * (1 - settle * 0.25) * energyK;
  const warm = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, radius);
  warm.addColorStop(0, `rgba(255, 190, 60, ${opacity})`);
  warm.addColorStop(0.3, `rgba(255, 158, 36, ${opacity * 0.45})`);
  warm.addColorStop(0.65, `rgba(255, 140, 30, ${opacity * 0.14})`);
  warm.addColorStop(1, 'rgba(255, 140, 30, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(sunX - radius, sunY - radius, radius * 2, radius * 2);

  // ---- two painted light shafts, rotating imperceptibly ----
  const shaftAlpha = (0.05 + 0.03 * breathe) * energyK * (1 - settle * 0.35);
  const shaftLen = Math.max(width, height) * 0.75;
  for (let i = 0; i < 2; i++) {
    const baseAngle = seed.phase + i * 2.3 + verySlow * (i === 0 ? 0.4 : -0.55);
    drawShaft(
      ctx,
      sunX,
      sunY,
      baseAngle,
      shaftLen,
      Math.max(width, height) * 0.07,
      [255, 186, 80],
      shaftAlpha
    );
  }

  // ---- very slow atmospheric blue — the sea moves through the air ----
  const blueX = width * (0.16 + 0.68 * (0.5 + 0.5 * Math.sin(verySlow * 3.3 + seed.phase * 2)));
  const blueY = waterTop * 0.55;
  const blueR = Math.max(Math.min(width, height) * 0.8, height * 0.3);
  const blue = ctx.createRadialGradient(blueX, blueY, 0, blueX, blueY, blueR);
  const blueA = 0.17 * (1 - settle * 0.2) * (0.7 + 0.3 * energy);
  blue.addColorStop(0, `rgba(38, 148, 188, ${blueA})`);
  blue.addColorStop(1, 'rgba(38, 148, 188, 0)');
  ctx.fillStyle = blue;
  ctx.fillRect(blueX - blueR, blueY - blueR, blueR * 2, blueR * 2);

  // ---- cool edge light from the sky — air reads as sea-coloured ----
  const edge = ctx.createLinearGradient(0, 0, 0, waterTop * 0.6);
  const edgeA = 0.1 * (1 - settle * 0.25) * (0.6 + 0.4 * energy);
  edge.addColorStop(0, `rgba(42, 156, 196, ${edgeA})`);
  edge.addColorStop(1, 'rgba(42, 156, 196, 0)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, width, waterTop * 0.6);

  // ---- cool reflected light rising from the water into the scene ----
  const washH = height * 0.5;
  const washA = (0.2 + breathe * 0.06) * energyK * (1 - settle * 0.3);
  const wash = ctx.createLinearGradient(0, height, 0, height - washH);
  wash.addColorStop(0, `rgba(52, 176, 199, ${washA})`);
  wash.addColorStop(0.55, `rgba(40, 150, 178, ${washA * 0.4})`);
  wash.addColorStop(1, 'rgba(40, 150, 178, 0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}
