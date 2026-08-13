import type { PosterLayout, PosterPalette, TextBlock, VariantId, TapePiece, Mark } from './types';
import { GRID, SPACING, buildTypoStack, scorePosterLayout } from './layoutEngine';

/**
 * Five distinct poster composition strategies, all built on the fixed
 * 1080 × 1350 grid system:
 *
 *   A  Editorial Side-by-Side — photo left column, typography stack right column
 *   B  Photo-Led Hero          — large central portrait emphasis, text below
 *   C  High-Impact Stacked     — giant watermark type, centered photo & text stack
 *   D  Asymmetric Pass/Ticket  — admission pass with perforation, stub photo, body text
 *   E  Painterly / Graphic      — pigment stripe accent, offset photo, bold stack
 *
 * Seeded RNG drives subtle rotation, texture, and marks, but geometry is
 * strictly governed by the relational layout engine.
 */

const TWO_PI = Math.PI * 2;

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

interface Input {
  name: string;
  role: string;
  idNumber: string;
  title: string;
}

function buildBase(
  rng: () => number,
  variant: VariantId,
  palette: PosterPalette
): Omit<
  PosterLayout,
  'name' | 'role' | 'title' | 'idNumber' | 'nameBlock' | 'roleBlock' | 'titleBlock' | 'photo' | 'waves' | 'sun' | 'palms' | 'stamp' | 'marks' | 'ghost' | 'ticket' | 'paint'
> {
  return {
    variant,
    seed: Math.floor(rng() * 1e9),
    palette,
    headerLeft: {
      x: GRID.MARGIN_X,
      y: GRID.HEADER_Y,
      size: 25,
      rotation: 0,
      align: 'left',
      anchor: 'baseline',
      color: palette.ink,
      font: 'ui',
      weight: 700,
      maxWidth: 620,
      letterSpacing: 3.5,
      uppercase: true,
    },
    headerRight: {
      x: GRID.W - GRID.MARGIN_X,
      y: GRID.HEADER_Y,
      size: 25,
      rotation: 0,
      align: 'right',
      anchor: 'baseline',
      color: palette.ink,
      font: 'ui',
      weight: 700,
      maxWidth: 460,
      letterSpacing: 3,
      uppercase: true,
    },
    footer: [
      {
        x: GRID.MARGIN_X,
        y: GRID.FOOTER_Y,
        size: 22,
        rotation: 0,
        align: 'left',
        anchor: 'baseline',
        color: palette.ink,
        font: 'ui',
        weight: 600,
        maxWidth: 360,
        letterSpacing: 2.5,
        uppercase: true,
      },
      {
        x: GRID.W / 2,
        y: GRID.FOOTER_Y,
        size: 22,
        rotation: 0,
        align: 'center',
        anchor: 'baseline',
        color: palette.ink,
        font: 'ui',
        weight: 600,
        maxWidth: 420,
        letterSpacing: 2.5,
        uppercase: true,
      },
      {
        x: GRID.W - GRID.MARGIN_X,
        y: GRID.FOOTER_Y,
        size: 22,
        rotation: 0,
        align: 'right',
        anchor: 'baseline',
        color: palette.ink,
        font: 'ui',
        weight: 700,
        maxWidth: 380,
        letterSpacing: 2.5,
        uppercase: true,
      },
    ],
  };
}

/**
 * Anchors the hand-drawn underline directly beneath the name block — below
 * the last line's baseline, centered on the measured text — so it always
 * hugs the name instead of drifting into the middle of the type or floating
 * off to one side.
 */
function nameUnderline(nameBlock: TextBlock): { x: number; y: number; w: number } {
  const lines = nameBlock.lines ?? [nameBlock.text ?? ''];
  const lh = nameBlock.lineHeight ?? nameBlock.size * 1.05;
  const lastBaseline = nameBlock.y + (Math.max(1, lines.length) - 1) * lh;
  const width = Math.max(140, (nameBlock.maxLineWidth ?? nameBlock.maxWidth) * 0.92);
  const x =
    nameBlock.align === 'left'
      ? nameBlock.x + width / 2
      : nameBlock.align === 'right'
        ? nameBlock.x - width / 2
        : nameBlock.x;
  return { x, y: lastBaseline + Math.max(14, lh * 0.24), w: width };
}

function generateTape(w: number, h: number, rng: () => number): TapePiece[] {
  const pieces: TapePiece[] = [
    { x: -w * 0.3, y: -h / 2 - 2, rotation: -12 + (rng() - 0.5) * 8, w: 84, h: 28 },
    { x: w * 0.3, y: -h / 2 - 2, rotation: 10 + (rng() - 0.5) * 8, w: 84, h: 28 },
  ];
  if (rng() > 0.45) {
    pieces.push({ x: w * 0.26, y: h / 2 + 2, rotation: 12 + (rng() - 0.5) * 10, w: 78, h: 26 });
  }
  return pieces;
}

/* ------------------------------------------------------------------ */
/* Variant A — Editorial Side-by-Side                                  */
/* ------------------------------------------------------------------ */

function variantA(rng: () => number, input: Input, palette: PosterPalette): PosterLayout {
  const base = buildBase(rng, 'A', palette);

  // Photo in Left Column (Center X = 267)
  const photoW = 370;
  const photoH = 450;
  const photoX = GRID.COL_LEFT.center;
  const photoY = 430;

  const photo = {
    x: photoX,
    y: photoY,
    w: photoW,
    h: photoH,
    rotation: -1.8 + (rng() - 0.5) * 1.2,
    matInset: 32,
    tearSeed: Math.floor(rng() * 1e6) + 11,
    tape: generateTape(photoW, photoH, rng),
    label: {
      text: `you · ${firstName(input.name)}`,
      x: photoW * 0.22,
      y: -photoH / 2 - 20,
      rotation: 4 + (rng() - 0.5) * 6,
      color: palette.accent,
    },
  };

  // Typography Stack in Right Column (X = 510, width = 490, Left aligned)
  const stack = buildTypoStack({
    name: { text: input.name, initialSize: 104, minSize: 60 },
    role: { text: input.role, initialSize: 44, minSize: 28, italic: true },
    title: { text: input.title, initialSize: 40, minSize: 26 },
    align: 'left',
    x: GRID.COL_RIGHT.x,
    startY: 300,
    maxWidth: GRID.COL_RIGHT.w - 16,
    maxAvailableHeight: 630,
  });

  const marks: Mark[] = [
    {
      kind: 'underline',
      ...nameUnderline(stack.nameBlock),
      rotation: 0,
      color: palette.accent,
    },
    {
      kind: 'arrow',
      x: photoX + photoW / 2 - 20,
      y: photoY - photoH / 2 - 20,
      rotation: -25,
      length: 100,
      color: palette.accent2,
    },
  ];

  if (rng() > 0.5) {
    marks.push({ kind: 'star', x: 190, y: 170, r: 24, rotation: rng() * 20, color: palette.accent });
  }

  return {
    ...base,
    name: input.name,
    role: input.role,
    title: input.title,
    idNumber: input.idNumber,
    nameBlock: stack.nameBlock,
    roleBlock: stack.roleBlock,
    titleBlock: stack.titleBlock,
    photo,
    waves: { y: 1200, colors: [palette.ocean, palette.oceanLight, palette.turquoise], amp: 45, seed: rng() * TWO_PI },
    sun: { x: 920, y: 150, r: 76, color: palette.sun, rays: 12, seed: rng() * TWO_PI },
    palms: [
      { x: 90, y: 1290, h: 170, seed: 3, lean: 1, opacity: 0.85 },
      { x: 990, y: 1290, h: 160, seed: 7, lean: -1, opacity: 0.85 },
    ],
    stamp: { x: photoX + photoW / 2 + 26, y: photoY + photoH / 2 + 10, r: 58, rotation: -8 + (rng() - 0.5) * 8, color: palette.accent, text1: 'BUILDER', text2: 'LOCKED' },
    marks,
  };
}

/* ------------------------------------------------------------------ */
/* Variant B — Photo-Led Hero                                         */
/* ------------------------------------------------------------------ */

function variantB(rng: () => number, input: Input, palette: PosterPalette): PosterLayout {
  const base = buildBase(rng, 'B', palette);

  // Photo top center
  const photoW = 400;
  const photoH = 440;
  const photoX = GRID.COL_CENTER.center;
  const photoY = 370;

  const photo = {
    x: photoX,
    y: photoY,
    w: photoW,
    h: photoH,
    rotation: 1.8 + (rng() - 0.5) * 1.2,
    matInset: 34,
    tearSeed: Math.floor(rng() * 1e6) + 23,
    tape: generateTape(photoW, photoH, rng),
    label: {
      text: `you · ${firstName(input.name)}`,
      x: photoW * 0.25,
      y: -photoH / 2 - 20,
      rotation: -4 + (rng() - 0.5) * 6,
      color: palette.accent,
    },
  };

  // Stack centered below photo
  const stack = buildTypoStack({
    name: { text: input.name, initialSize: 104, minSize: 60 },
    role: { text: input.role, initialSize: 44, minSize: 28, italic: true },
    title: { text: input.title, initialSize: 40, minSize: 26 },
    align: 'center',
    x: GRID.COL_CENTER.center,
    startY: photoY + photoH / 2 + SPACING.md,
    maxWidth: GRID.COL_CENTER.w,
    maxAvailableHeight: GRID.SAFE_CONTENT_BOTTOM - (photoY + photoH / 2 + SPACING.md),
  });

  const marks: Mark[] = [
    {
      kind: 'underline',
      ...nameUnderline(stack.nameBlock),
      rotation: 0,
      color: palette.accent,
    },
  ];

  if (rng() > 0.5) {
    marks.push({ kind: 'star', x: 540, y: 150, r: 24, rotation: rng() * 30, color: palette.accent });
  }

  return {
    ...base,
    name: input.name,
    role: input.role,
    title: input.title,
    idNumber: input.idNumber,
    nameBlock: stack.nameBlock,
    roleBlock: stack.roleBlock,
    titleBlock: stack.titleBlock,
    photo,
    waves: { y: 1200, colors: [palette.ocean, palette.oceanLight, palette.turquoise], amp: 45, seed: rng() * TWO_PI },
    sun: { x: 160, y: 150, r: 80, color: palette.sun, rays: 12, seed: rng() * TWO_PI },
    palms: [
      { x: 96, y: 1290, h: 170, seed: 5, lean: 1, opacity: 0.85 },
      { x: 984, y: 1290, h: 160, seed: 9, lean: -1, opacity: 0.85 },
    ],
    stamp: { x: photoX + photoW / 2 + 20, y: photoY + photoH / 2 - 10, r: 56, rotation: 8 + (rng() - 0.5) * 8, color: palette.accent, text1: 'HH GOA', text2: '2026' },
    marks,
  };
}

/* ------------------------------------------------------------------ */
/* Variant C — High-Impact Stacked                                    */
/* ------------------------------------------------------------------ */

function variantC(rng: () => number, input: Input, palette: PosterPalette): PosterLayout {
  const base = buildBase(rng, 'C', palette);

  const photoW = 400;
  const photoH = 440;
  const photoX = GRID.COL_CENTER.center;
  const photoY = 400;

  const photo = {
    x: photoX,
    y: photoY,
    w: photoW,
    h: photoH,
    rotation: -1.2 + (rng() - 0.5) * 1.0,
    matInset: 36,
    tearSeed: Math.floor(rng() * 1e6) + 37,
    tape: generateTape(photoW, photoH, rng),
    label: {
      text: `you · ${firstName(input.name)}`,
      x: photoW * 0.24,
      y: -photoH / 2 - 20,
      rotation: 5 + (rng() - 0.5) * 6,
      color: palette.accent,
    },
  };

  const stack = buildTypoStack({
    name: { text: input.name, initialSize: 110, minSize: 64 },
    role: { text: input.role, initialSize: 46, minSize: 28, italic: true },
    title: { text: input.title, initialSize: 42, minSize: 26 },
    align: 'center',
    x: GRID.COL_CENTER.center,
    startY: photoY + photoH / 2 + SPACING.md,
    maxWidth: GRID.COL_CENTER.w,
    maxAvailableHeight: GRID.SAFE_CONTENT_BOTTOM - (photoY + photoH / 2 + SPACING.md),
  });

  const marks: Mark[] = [
    {
      kind: 'underline',
      ...nameUnderline(stack.nameBlock),
      rotation: 0,
      color: palette.accent,
    },
  ];

  return {
    ...base,
    name: input.name,
    role: input.role,
    title: input.title,
    idNumber: input.idNumber,
    ghost: {
      x: GRID.COL_CENTER.center,
      y: 340,
      size: 160,
      rotation: -2,
      align: 'center',
      anchor: 'middle',
      color: 'rgba(42, 150, 184, 0.16)',
      font: 'display',
      weight: 800,
      maxWidth: 1000,
      maxLines: 1,
    },
    nameBlock: stack.nameBlock,
    roleBlock: stack.roleBlock,
    titleBlock: stack.titleBlock,
    photo,
    waves: { y: 1200, colors: [palette.ocean, palette.oceanLight, palette.turquoise], amp: 45, seed: rng() * TWO_PI },
    sun: { x: 920, y: 160, r: 84, color: palette.sun, rays: 12, seed: rng() * TWO_PI },
    palms: [
      { x: 92, y: 1290, h: 175, seed: 4, lean: 1, opacity: 0.85 },
      { x: 988, y: 1290, h: 155, seed: 8, lean: -1, opacity: 0.85 },
    ],
    stamp: { x: photoX - photoW / 2 - 20, y: photoY + photoH / 2 - 10, r: 56, rotation: -6 + (rng() - 0.5) * 8, color: palette.accent, text1: 'GOA', text2: '2026' },
    marks,
  };
}

/* ------------------------------------------------------------------ */
/* Variant D — Asymmetric Pass / Ticket                               */
/* ------------------------------------------------------------------ */

function variantD(rng: () => number, input: Input, palette: PosterPalette): PosterLayout {
  const base = buildBase(rng, 'D', palette);

  const ticketX = 84;
  const ticketY = 160;
  const ticketW = 912;
  const ticketH = 880;
  const stubW = 330;

  // Photo inside left stub
  const photoW = 240;
  const photoH = 300;
  const photoX = ticketX + stubW / 2;
  const photoY = ticketY + 250;

  const photo = {
    x: photoX,
    y: photoY,
    w: photoW,
    h: photoH,
    rotation: -1.5 + (rng() - 0.5) * 1.0,
    matInset: 24,
    tearSeed: Math.floor(rng() * 1e6) + 53,
    tape: generateTape(photoW, photoH, rng).slice(0, 2),
    label: { text: 'you', x: photoW * 0.28, y: -photoH / 2 - 16, rotation: -4 + (rng() - 0.5) * 8, color: palette.accent },
  };

  // Stack in right ticket body
  const bodyX = ticketX + stubW + 40;
  const bodyW = ticketW - stubW - 60;
  const stack = buildTypoStack({
    name: { text: input.name, initialSize: 90, minSize: 54 },
    role: { text: input.role, initialSize: 38, minSize: 26, italic: true },
    title: { text: input.title, initialSize: 36, minSize: 24 },
    align: 'left',
    x: bodyX,
    startY: ticketY + 160,
    maxWidth: bodyW,
    maxAvailableHeight: 560,
  });

  const marks: Mark[] = [
    {
      kind: 'underline',
      ...nameUnderline(stack.nameBlock),
      rotation: 0,
      color: palette.accent,
    },
    {
      kind: 'star',
      x: bodyX + bodyW - 40,
      y: ticketY + 140,
      r: 22,
      rotation: rng() * 30,
      color: palette.accent,
    },
  ];

  return {
    ...base,
    name: input.name,
    role: input.role,
    title: input.title,
    idNumber: input.idNumber,
    nameBlock: stack.nameBlock,
    roleBlock: stack.roleBlock,
    titleBlock: stack.titleBlock,
    photo,
    waves: { y: 1200, colors: [palette.ocean, palette.oceanLight, palette.turquoise], amp: 45, seed: rng() * TWO_PI },
    sun: { x: 920, y: 140, r: 76, color: palette.sun, rays: 10, seed: rng() * TWO_PI },
    palms: [
      { x: 92, y: 1290, h: 170, seed: 6, lean: 1, opacity: 0.85 },
      { x: 988, y: 1290, h: 150, seed: 10, lean: -1, opacity: 0.85 },
    ],
    stamp: { x: ticketX + ticketW - 90, y: ticketY + ticketH - 120, r: 56, rotation: 8 + (rng() - 0.5) * 8, color: palette.accent, text1: 'ADMIT', text2: 'BUILDER' },
    marks,
    ticket: {
      x: ticketX,
      y: ticketY,
      w: ticketW,
      h: ticketH,
      perforationY: ticketY + ticketH - 120,
      stubWidth: stubW,
      borderColor: 'rgba(11, 43, 31, 0.55)',
    },
  };
}

/* ------------------------------------------------------------------ */
/* Variant E — Painterly / Graphic                                     */
/* ------------------------------------------------------------------ */

function variantE(rng: () => number, input: Input, palette: PosterPalette): PosterLayout {
  const base = buildBase(rng, 'E', palette);

  const photoW = 370;
  const photoH = 430;
  const photoX = 290;
  const photoY = 390;

  const photo = {
    x: photoX,
    y: photoY,
    w: photoW,
    h: photoH,
    rotation: -2.5 + (rng() - 0.5) * 1.0,
    matInset: 34,
    tearSeed: Math.floor(rng() * 1e6) + 71,
    tape: generateTape(photoW, photoH, rng),
    label: {
      text: `you · ${firstName(input.name)}`,
      x: photoW * 0.22,
      y: -photoH / 2 - 20,
      rotation: -5 + (rng() - 0.5) * 6,
      color: palette.accent,
    },
  };

  const stack = buildTypoStack({
    name: { text: input.name, initialSize: 104, minSize: 60 },
    role: { text: input.role, initialSize: 44, minSize: 28, font: 'hand', italic: false },
    title: { text: input.title, initialSize: 40, minSize: 26, font: 'display' },
    align: 'center',
    x: GRID.COL_CENTER.center,
    startY: photoY + photoH / 2 + SPACING.md,
    maxWidth: GRID.COL_CENTER.w,
    maxAvailableHeight: GRID.SAFE_CONTENT_BOTTOM - (photoY + photoH / 2 + SPACING.md),
  });

  // no arrow here — a floating hand-arrow with nothing to point at reads as
  // noise, so variant E keeps only the star sparkle
  const marks: Mark[] = [
    { kind: 'star', x: 620, y: 170, r: 26, rotation: rng() * 30, color: palette.accent },
  ];

  return {
    ...base,
    name: input.name,
    role: input.role,
    title: input.title,
    idNumber: input.idNumber,
    nameBlock: stack.nameBlock,
    roleBlock: stack.roleBlock,
    titleBlock: stack.titleBlock,
    photo,
    waves: { y: 1200, colors: [palette.ocean, palette.oceanLight, palette.turquoise], amp: 45, seed: rng() * TWO_PI },
    sun: { x: 920, y: 180, r: 100, color: palette.sun, rays: 14, seed: rng() * TWO_PI },
    palms: [
      { x: 96, y: 1290, h: 170, seed: 13, lean: 1, opacity: 0.85 },
      { x: 984, y: 1290, h: 150, seed: 17, lean: -1, opacity: 0.85 },
    ],
    stamp: { x: photoX - photoW / 2 - 20, y: photoY + photoH / 2 - 10, r: 56, rotation: -10 + (rng() - 0.5) * 8, color: palette.accent, text1: 'BUILDER', text2: 'ID' },
    marks,
    paint: {
      x: GRID.COL_CENTER.center,
      y: stack.nameBlock.y - (stack.nameBlock.lineHeight ?? 60) * 0.35,
      w: 780,
      h: 110,
      rotation: -1.2,
      color: palette.sun,
      seed: 91,
      opacity: 0.85,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Entry Point                                                         */
/* ------------------------------------------------------------------ */

export function buildVariant(
  rng: () => number,
  input: Input,
  variant: VariantId,
  palette: PosterPalette
): PosterLayout {
  const layout =
    variant === 'A'
      ? variantA(rng, input, palette)
      : variant === 'B'
        ? variantB(rng, input, palette)
        : variant === 'C'
          ? variantC(rng, input, palette)
          : variant === 'D'
            ? variantD(rng, input, palette)
            : variantE(rng, input, palette);

  layout.title = input.title;
  layout.headerLeft.text = 'Hacker House Goa 2026';
  layout.headerRight.text = `Builder ID ${layout.idNumber}`;
  layout.footer[0].text = 'Goa · India';
  layout.footer[1].text = '28–31 Oct 2026';
  layout.footer[2].text = '#FrameInGoa';
  layout.ghostText = layout.ghost ? ghostNameFor(layout) : undefined;

  // Validate poster layout quality
  const scoreResult = scorePosterLayout(layout);
  if (!scoreResult.valid) {
    // Emergency scale adjustment for safe area compliance
    layout.nameBlock.size *= 0.9;
    layout.roleBlock.size *= 0.9;
    layout.titleBlock.size *= 0.9;
  }

  return layout;
}

function ghostNameFor(layout: PosterLayout): string {
  return layout.name.split(/\s+/)[0]?.toUpperCase() ?? 'GOA';
}
