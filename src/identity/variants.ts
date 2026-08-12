import type { PosterLayout, PosterPalette, VariantId, TapePiece, Mark } from './types';

/**
 * Four composition families, all in the 1080 × 1350 design space, all
 * clearly the same Frame-in-Goa universe:
 *
 *   A  Portrait & Type      — big taped portrait, giant centered name below
 *   B  Editorial Offset     — portrait left, large role typography right
 *   C  Type Behind          — giant blue type behind the portrait, wave foreground
 *   D  Ticket / Pass        — a collectible admission pass with perforation
 *
 * The seed picks the variant and drives every detail (rotation, tape,
 * marks, stamp angle, sun position) — the same inputs always produce the
 * same poster, and different builders get visibly different ones.
 */

const TWO_PI = Math.PI * 2;

function tapeFor(cx: number, cy: number, w: number, h: number, rng: () => number): TapePiece[] {
  const pieces: TapePiece[] = [
    { x: cx - w * 0.34, y: cy - h * 0.34, rotation: -14 + (rng() - 0.5) * 10, w: 84, h: 30 },
    { x: cx + w * 0.34, y: cy - h * 0.36, rotation: 8 + (rng() - 0.5) * 10, w: 84, h: 30 },
  ];
  if (rng() > 0.45) {
    pieces.push({ x: cx + w * 0.3, y: cy + h * 0.38, rotation: 12 + (rng() - 0.5) * 12, w: 78, h: 28 });
  }
  return pieces;
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

interface Input {
  name: string;
  role: string;
  idNumber: string;
}

function buildBase(
  rng: () => number,
  variant: VariantId,
  palette: PosterPalette
): Omit<PosterLayout, 'name' | 'role' | 'idNumber' | 'nameBlock' | 'roleBlock' | 'photo' | 'waves' | 'sun' | 'palms' | 'stamp' | 'marks' | 'ghost' | 'ticket'> {
  return {
    variant,
    seed: Math.floor(rng() * 1e9),
    palette,
    headerLeft: {
      x: 56,
      y: 74,
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
      x: 1024,
      y: 74,
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
        x: 56,
        y: 1308,
        size: 22,
        rotation: 0,
        align: 'left',
        anchor: 'baseline',
        color: palette.inkSoft,
        font: 'ui',
        weight: 600,
        maxWidth: 360,
        letterSpacing: 2.5,
        uppercase: true,
      },
      {
        x: 540,
        y: 1308,
        size: 22,
        rotation: 0,
        align: 'center',
        anchor: 'baseline',
        color: palette.inkSoft,
        font: 'ui',
        weight: 600,
        maxWidth: 420,
        letterSpacing: 2.5,
        uppercase: true,
      },
      {
        x: 1024,
        y: 1308,
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

/* ------------------------------------------------------------------ */
/* Variant A — Portrait & Type                                         */
/* ------------------------------------------------------------------ */

function variantA(rng: () => number, input: Input, palette: PosterPalette): PosterLayout {
  const base = buildBase(rng, 'A', palette);
  const photo = {
    x: 540,
    y: 438,
    w: 424,
    h: 505,
    rotation: -2.2 + (rng() - 0.5) * 1.4,
    matInset: 36,
    tearSeed: Math.floor(rng() * 1e6) + 11,
    tape: tapeFor(540, 438, 424, 505, rng),
    label: {
      text: `you · ${firstName(input.name)}`,
      x: 762,
      y: 196,
      rotation: 5 + (rng() - 0.5) * 6,
      color: palette.accent,
    },
  };

  const marks: Mark[] = [
    {
      kind: 'underline',
      x: 540,
      y: 1178,
      w: 520,
      rotation: 0,
      color: palette.accent,
    },
    {
      kind: 'arrow',
      x: 862,
      y: 546,
      rotation: -24,
      length: 158,
      color: palette.accent2,
    },
  ];
  if (rng() > 0.5) {
    marks.push({ kind: 'star', x: 218, y: 200, r: 26, rotation: rng() * 20, color: palette.accent });
  }
  if (rng() > 0.6) {
    marks.push({ kind: 'scribble', x: 400, y: 1100, w: 120, rotation: -4, color: palette.inkSoft });
  }

  return {
    ...base,
    name: input.name,
    role: input.role,
    idNumber: input.idNumber,
    nameBlock: {
      x: 540,
      y: 1030,
      size: 152,
      rotation: 0,
      align: 'center',
      anchor: 'baseline',
      color: palette.ink,
      font: 'display',
      weight: 700,
      maxWidth: 1000,
      maxLines: 2,
    },
    roleBlock: {
      x: 540,
      y: 1128,
      size: 56,
      rotation: 0,
      align: 'center',
      anchor: 'baseline',
      color: palette.accent,
      font: 'display',
      italic: true,
      weight: 500,
      maxWidth: 920,
      maxLines: 1,
    },
    photo,
    waves: { y: 1194, colors: [palette.ocean, palette.oceanLight, palette.turquoise], amp: 64, seed: rng() * TWO_PI },
    sun: { x: 150, y: 152, r: 92, color: palette.sun, rays: 12, seed: rng() * TWO_PI },
    palms: [
      { x: 96, y: 1172, h: 190, seed: 3, lean: 1, opacity: 0.85 },
      { x: 984, y: 1172, h: 158, seed: 7, lean: -1, opacity: 0.85 },
    ],
    stamp: { x: 712, y: 736, r: 62, rotation: -8 + (rng() - 0.5) * 8, color: palette.accent, text1: 'BUILDER', text2: 'LOCKED' },
    marks,
  };
}

/* ------------------------------------------------------------------ */
/* Variant B — Editorial Offset                                        */
/* ------------------------------------------------------------------ */

function variantB(rng: () => number, input: Input, palette: PosterPalette): PosterLayout {
  const base = buildBase(rng, 'B', palette);
  const photo = {
    x: 258,
    y: 522,
    w: 360,
    h: 442,
    rotation: 2.4 + (rng() - 0.5) * 1.2,
    matInset: 32,
    tearSeed: Math.floor(rng() * 1e6) + 23,
    tape: tapeFor(258, 522, 360, 442, rng),
    label: { text: 'you', x: 452, y: 316, rotation: -4 + (rng() - 0.5) * 8, color: palette.accent },
  };

  const marks: Mark[] = [
    {
      kind: 'underline',
      x: 652,
      y: 706,
      w: 380,
      rotation: 0,
      color: palette.accent,
    },
    {
      kind: 'arrow',
      x: 640,
      y: 560,
      rotation: 168,
      length: 150,
      color: palette.accent2,
    },
  ];
  if (rng() > 0.55) {
    marks.push({ kind: 'star', x: 540, y: 250, r: 24, rotation: rng() * 30, color: palette.accent });
  }
  if (rng() > 0.6) {
    marks.push({ kind: 'scribble', x: 700, y: 980, w: 130, rotation: -6, color: palette.inkSoft });
  }

  return {
    ...base,
    name: input.name,
    role: input.role,
    idNumber: input.idNumber,
    nameBlock: {
      x: 648,
      y: 566,
      size: 128,
      rotation: 0,
      align: 'left',
      anchor: 'baseline',
      color: palette.ink,
      font: 'display',
      weight: 700,
      maxWidth: 470,
      maxLines: 3,
    },
    roleBlock: {
      x: 648,
      y: 660,
      size: 50,
      rotation: 0,
      align: 'left',
      anchor: 'baseline',
      color: palette.accent,
      font: 'display',
      italic: true,
      weight: 500,
      maxWidth: 460,
      maxLines: 2,
    },
    photo,
    waves: { y: 1194, colors: [palette.ocean, palette.oceanLight, palette.turquoise], amp: 62, seed: rng() * TWO_PI },
    sun: { x: 932, y: 148, r: 74, color: palette.sun, rays: 10, seed: rng() * TWO_PI },
    palms: [
      { x: 96, y: 1172, h: 200, seed: 5, lean: 1, opacity: 0.85 },
      { x: 984, y: 1172, h: 166, seed: 9, lean: -1, opacity: 0.85 },
    ],
    stamp: { x: 790, y: 402, r: 58, rotation: 9 + (rng() - 0.5) * 8, color: palette.accent, text1: 'HH GOA', text2: '2026' },
    marks,
  };
}

/* ------------------------------------------------------------------ */
/* Variant C — Type Behind                                             */
/* ------------------------------------------------------------------ */

function variantC(rng: () => number, input: Input, palette: PosterPalette): PosterLayout {
  const base = buildBase(rng, 'C', palette);
  const photo = {
    x: 540,
    y: 566,
    w: 464,
    h: 505,
    rotation: -1.4 + (rng() - 0.5) * 1.2,
    matInset: 38,
    tearSeed: Math.floor(rng() * 1e6) + 37,
    tape: tapeFor(540, 566, 464, 505, rng),
    label: { text: `you · ${firstName(input.name)}`, x: 778, y: 326, rotation: 5 + (rng() - 0.5) * 6, color: palette.accent },
  };

  const marks: Mark[] = [
    {
      kind: 'underline',
      x: 540,
      y: 1212,
      w: 500,
      rotation: 0,
      color: palette.accent,
    },
  ];
  if (rng() > 0.5) {
    marks.push({ kind: 'star', x: 240, y: 290, r: 24, rotation: rng() * 30, color: palette.accent });
  }

  return {
    ...base,
    name: input.name,
    role: input.role,
    idNumber: input.idNumber,
    ghost: {
      x: 540,
      y: 700,
      size: 236,
      rotation: -3 + (rng() - 0.5) * 3,
      align: 'center',
      anchor: 'middle',
      color: 'rgba(42, 150, 184, 0.30)',
      font: 'display',
      weight: 800,
      maxWidth: 1020,
      maxLines: 2,
    },
    nameBlock: {
      x: 540,
      y: 1082,
      size: 140,
      rotation: 0,
      align: 'center',
      anchor: 'baseline',
      color: palette.ink,
      font: 'display',
      weight: 700,
      maxWidth: 1000,
      maxLines: 2,
    },
    roleBlock: {
      x: 540,
      y: 1166,
      size: 52,
      rotation: 0,
      align: 'center',
      anchor: 'baseline',
      color: palette.accent,
      font: 'display',
      italic: true,
      weight: 500,
      maxWidth: 900,
      maxLines: 1,
    },
    photo,
    waves: { y: 1232, colors: [palette.ocean, palette.oceanLight, palette.turquoise], amp: 74, seed: rng() * TWO_PI },
    sun: { x: 168, y: 168, r: 100, color: palette.sun, rays: 12, seed: rng() * TWO_PI },
    palms: [
      { x: 92, y: 1208, h: 190, seed: 4, lean: 1, opacity: 0.85 },
      { x: 988, y: 1208, h: 158, seed: 8, lean: -1, opacity: 0.85 },
    ],
    stamp: { x: 348, y: 796, r: 60, rotation: -6 + (rng() - 0.5) * 8, color: palette.accent, text1: 'GOA', text2: '2026' },
    marks,
  };
}

/* ------------------------------------------------------------------ */
/* Variant D — Ticket / Pass                                           */
/* ------------------------------------------------------------------ */

function variantD(rng: () => number, input: Input, palette: PosterPalette): PosterLayout {
  const base = buildBase(rng, 'D', palette);
  const photo = {
    x: 250,
    y: 470,
    w: 226,
    h: 288,
    rotation: -1.5 + (rng() - 0.5) * 1.4,
    matInset: 26,
    tearSeed: Math.floor(rng() * 1e6) + 53,
    tape: tapeFor(250, 470, 226, 288, rng).slice(0, 2),
    label: { text: 'you', x: 388, y: 316, rotation: -4 + (rng() - 0.5) * 8, color: palette.accent },
  };

  const marks: Mark[] = [
    {
      kind: 'underline',
      x: 560,
      y: 606,
      w: 340,
      rotation: 0,
      color: palette.accent,
    },
    {
      kind: 'star',
      x: 700,
      y: 830,
      r: 22,
      rotation: rng() * 30,
      color: palette.accent,
    },
  ];

  return {
    ...base,
    name: input.name,
    role: input.role,
    idNumber: input.idNumber,
    nameBlock: {
      x: 560,
      y: 470,
      size: 96,
      rotation: 0,
      align: 'left',
      anchor: 'baseline',
      color: palette.ink,
      font: 'display',
      weight: 700,
      maxWidth: 540,
      maxLines: 2,
    },
    roleBlock: {
      x: 560,
      y: 566,
      size: 42,
      rotation: 0,
      align: 'left',
      anchor: 'baseline',
      color: palette.accent,
      font: 'display',
      italic: true,
      weight: 500,
      maxWidth: 500,
      maxLines: 2,
    },
    photo,
    waves: { y: 1216, colors: [palette.ocean, palette.oceanLight, palette.turquoise], amp: 60, seed: rng() * TWO_PI },
    sun: { x: 940, y: 132, r: 76, color: palette.sun, rays: 10, seed: rng() * TWO_PI },
    palms: [
      { x: 92, y: 1196, h: 180, seed: 6, lean: 1, opacity: 0.85 },
      { x: 988, y: 1196, h: 150, seed: 10, lean: -1, opacity: 0.85 },
    ],
    stamp: { x: 806, y: 872, r: 58, rotation: 8 + (rng() - 0.5) * 8, color: palette.accent, text1: 'ADMIT', text2: 'BUILDER' },
    marks,
    ticket: {
      x: 84,
      y: 196,
      w: 912,
      h: 952,
      perforationY: 700,
      stubWidth: 330,
      borderColor: 'rgba(11, 43, 31, 0.55)',
    },
  };
}

/* ------------------------------------------------------------------ */
/* entry                                                               */
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
          : variantD(rng, input, palette);

  layout.headerLeft.text = 'Hacker House Goa 2026';
  layout.headerRight.text = `Builder ID ${layout.idNumber}`;
  layout.footer[0].text = 'Goa · India';
  layout.footer[1].text = '28–31 Oct 2026';
  layout.footer[2].text = '#FrameInGoa';
  layout.ghostText = layout.ghost ? ghostNameFor(layout) : undefined;
  return layout;
}

function ghostNameFor(layout: PosterLayout): string {
  return layout.name.split(/\s+/)[0]?.toUpperCase() ?? 'GOA';
}
