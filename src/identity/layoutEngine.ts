import type { FontKind, TextBlock, PhotoPlacement, PosterLayout } from './types';
import { POSTER_W, POSTER_H } from './design';

/**
 * Poster Grid & Layout Engine for 1080 × 1350 Design Space.
 *
 * Implements a strict column grid, relational element anchoring, content-aware
 * typography fitting, safe-area bounds enforcement, and visual scoring.
 */

export const SPACING = {
  xs: 8,
  sm: 16,
  md: 28,
  lg: 44,
  xl: 68,
} as const;

export const GRID = {
  W: POSTER_W,
  H: POSTER_H,
  MARGIN_X: 64,
  HEADER_Y: 74,
  FOOTER_Y: 1308,

  // 2-column grid
  COL_LEFT: { x: 64, w: 406, center: 267 },
  GUTTER: 40,
  COL_RIGHT: { x: 510, w: 506, center: 763 },

  // 1-column grid
  COL_CENTER: { x: 64, w: 952, center: 540 },

  // Boundaries
  CONTENT_TOP: 130,
  SAFE_CONTENT_BOTTOM: 960, // Critical content (text/photo) must sit strictly <= 960
  OCEAN_TOP_MIN: 1100, // Waves undulate in environmental zone [1100..1250]
} as const;

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fallback character width factors per font kind when canvas context isn't active */
const FONT_WIDTH_FACTOR: Record<FontKind, number> = {
  display: 0.62, // Bodoni Moda is wide and high contrast
  ui: 0.58, // Space Grotesk
  hand: 0.48, // Caveat cursive
};

/** Measures text wrapping and exact bounding box height across font sizes */
export function measureText(
  text: string,
  font: FontKind,
  targetSize: number,
  minSize: number,
  maxWidth: number,
  maxLines = 2,
  uppercase = false
): {
  size: number;
  lines: string[];
  lineHeight: number;
  measuredHeight: number;
  maxLineWidth: number;
} {
  const raw = uppercase ? text.toUpperCase() : text;
  const words = raw.split(/\s+/).filter(Boolean);
  let size = targetSize;
  let lines: string[] = [];
  let lineHeight = 0;
  let measuredHeight = 0;
  let maxLineWidth = 0;

  // Try fitting at size, reducing down to minSize
  for (let attempt = 0; attempt < 16; attempt++) {
    const charW = size * FONT_WIDTH_FACTOR[font];
    lines = [];
    if (words.length === 0) {
      lines = [''];
    } else {
      let currentLine = words[0];
      for (let i = 1; i < words.length; i++) {
        const testLine = `${currentLine} ${words[i]}`;
        if (testLine.length * charW <= maxWidth) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = words[i];
        }
      }
      lines.push(currentLine);
    }

    const maxLineCharLen = Math.max(...lines.map((l) => l.length), 1);
    maxLineWidth = Math.min(maxWidth, maxLineCharLen * charW);

    if (lines.length <= maxLines && size <= targetSize) {
      const fits = lines.every((l) => l.length * charW <= maxWidth + 10);
      if (fits || size <= minSize) break;
    }

    if (size <= minSize) {
      lines = lines.slice(0, maxLines);
      break;
    }
    size = Math.max(minSize, size * 0.90);
  }

  const lineMult = font === 'hand' ? 1.22 : font === 'display' ? 1.05 : 1.02;
  lineHeight = size * lineMult;
  measuredHeight = lines.length * lineHeight;

  return {
    size,
    lines,
    lineHeight,
    measuredHeight,
    maxLineWidth,
  };
}

export interface TypoStackConfig {
  name: { text: string; initialSize: number; minSize: number; font?: FontKind; uppercase?: boolean };
  role: { text: string; initialSize: number; minSize: number; font?: FontKind; italic?: boolean };
  title: { text: string; initialSize: number; minSize: number; font?: FontKind };
  align: 'left' | 'center' | 'right';
  x: number;
  startY: number;
  maxWidth: number;
  maxAvailableHeight?: number;
}

export interface ResolvedTypoStack {
  nameBlock: TextBlock;
  roleBlock: TextBlock;
  titleBlock: TextBlock;
  totalHeight: number;
  bottomY: number;
}

/**
 * Calculates a non-overlapping vertical typography stack where Name, Role,
 * and Title flow sequentially with standard design spacing tokens.
 */
export function buildTypoStack(config: TypoStackConfig): ResolvedTypoStack {
  let nameSize = config.name.initialSize;
  let roleSize = config.role.initialSize;
  let titleSize = config.title.initialSize;

  const maxH = config.maxAvailableHeight ?? GRID.SAFE_CONTENT_BOTTOM - config.startY;

  // Measure initial blocks
  let nameM = measureText(
    config.name.text,
    config.name.font ?? 'display',
    nameSize,
    config.name.minSize,
    config.maxWidth,
    2,
    config.name.uppercase ?? false
  );
  let roleM = measureText(
    config.role.text,
    config.role.font ?? 'display',
    roleSize,
    config.role.minSize,
    config.maxWidth,
    2,
    false
  );
  let titleM = measureText(
    config.title.text,
    config.title.font ?? 'hand',
    titleSize,
    config.title.minSize,
    config.maxWidth,
    2,
    false
  );

  let gap1: number = SPACING.sm;
  let gap2: number = SPACING.md;
  let totalH = nameM.measuredHeight + gap1 + roleM.measuredHeight + gap2 + titleM.measuredHeight;

  // Scale down stack if total height exceeds available vertical region
  if (totalH > maxH && maxH > 100) {
    const scale = Math.max(0.7, maxH / totalH);
    nameSize = Math.max(config.name.minSize, nameSize * scale);
    roleSize = Math.max(config.role.minSize, roleSize * scale);
    titleSize = Math.max(config.title.minSize, titleSize * scale);

    nameM = measureText(
      config.name.text,
      config.name.font ?? 'display',
      nameSize,
      config.name.minSize,
      config.maxWidth,
      2,
      config.name.uppercase ?? false
    );
    roleM = measureText(
      config.role.text,
      config.role.font ?? 'display',
      roleSize,
      config.role.minSize,
      config.maxWidth,
      2,
      false
    );
    titleM = measureText(
      config.title.text,
      config.title.font ?? 'hand',
      titleSize,
      config.title.minSize,
      config.maxWidth,
      2,
      false
    );

    // keep a real gap above the role: the hand-drawn underline sits below
    // the name and needs room so it never collides with the role text
    gap1 = SPACING.sm;
    gap2 = SPACING.sm;
    totalH = nameM.measuredHeight + gap1 + roleM.measuredHeight + gap2 + titleM.measuredHeight;
  }

  // Calculate baseline positions (block top -> baseline = top + lineHeight * 0.8)
  const nameTop = config.startY;
  const nameY = nameTop + nameM.lineHeight * 0.8;

  const roleTop = nameTop + nameM.measuredHeight + gap1;
  const roleY = roleTop + roleM.lineHeight * 0.8;

  const titleTop = roleTop + roleM.measuredHeight + gap2;
  const titleY = titleTop + titleM.lineHeight * 0.8;

  const nameBlock: TextBlock = {
    text: config.name.text,
    x: config.x,
    y: nameY,
    size: nameM.size,
    rotation: 0,
    align: config.align,
    anchor: 'baseline',
    color: '#0b2b1f',
    font: config.name.font ?? 'display',
    weight: 700,
    maxWidth: config.maxWidth,
    maxLines: 2,
    uppercase: config.name.uppercase ?? false,
    lines: nameM.lines,
    measuredHeight: nameM.measuredHeight,
    lineHeight: nameM.lineHeight,
    maxLineWidth: nameM.maxLineWidth,
  };

  const roleBlock: TextBlock = {
    text: config.role.text,
    x: config.x,
    y: roleY,
    size: roleM.size,
    rotation: 0,
    align: config.align,
    anchor: 'baseline',
    color: '#0b2b1f',
    font: config.role.font ?? 'display',
    italic: config.role.italic ?? true,
    weight: 600,
    maxWidth: config.maxWidth,
    maxLines: 2,
    lines: roleM.lines,
    measuredHeight: roleM.measuredHeight,
    lineHeight: roleM.lineHeight,
    maxLineWidth: roleM.maxLineWidth,
  };

  const titleBlock: TextBlock = {
    text: config.title.text,
    x: config.x,
    y: titleY,
    size: titleM.size,
    rotation: -1.5,
    align: config.align,
    anchor: 'baseline',
    color: '#0b2b1f',
    font: config.title.font ?? 'hand',
    weight: 700,
    maxWidth: config.maxWidth,
    maxLines: 2,
    lines: titleM.lines,
    measuredHeight: titleM.measuredHeight,
    lineHeight: titleM.lineHeight,
    maxLineWidth: titleM.maxLineWidth,
  };

  return {
    nameBlock,
    roleBlock,
    titleBlock,
    totalHeight: totalH,
    bottomY: config.startY + totalH,
  };
}

/** Anchors tape, stamp, and label relative to photo frame geometry */
export function anchorPhotoDecorations(
  photoX: number,
  photoY: number,
  photoW: number,
  photoH: number,
  paletteAccent: string,
  firstName: string,
  rng: () => number
): {
  tape: PhotoPlacement['tape'];
  label: PhotoPlacement['label'];
  stampAnchor: { x: number; y: number };
} {
  const halfW = photoW / 2;
  const halfH = photoH / 2;

  // Tape pieces straddling top corners
  const tape: PhotoPlacement['tape'] = [
    { x: -halfW * 0.35, y: -halfH - 4, rotation: -12 + (rng() - 0.5) * 8, w: 84, h: 28 },
    { x: halfW * 0.35, y: -halfH - 4, rotation: 10 + (rng() - 0.5) * 8, w: 84, h: 28 },
  ];

  // Optional bottom tape piece
  if (rng() > 0.5) {
    tape.push({ x: halfW * 0.3, y: halfH + 4, rotation: 14 + (rng() - 0.5) * 10, w: 76, h: 26 });
  }

  // Label anchored top-right of mat
  const label: PhotoPlacement['label'] = {
    text: `you · ${firstName}`,
    x: halfW * 0.55,
    y: -halfH - 18,
    rotation: 4 + (rng() - 0.5) * 6,
    color: paletteAccent,
  };

  // Stamp anchored to photo bottom-left
  const stampAnchor = {
    x: photoX - halfW * 0.75,
    y: photoY + halfH * 0.85,
  };

  return { tape, label, stampAnchor };
}

/** Check rectangle intersection */
export function doRectsIntersect(a: BoundingBox, b: BoundingBox, padding = 0): boolean {
  return !(
    a.x + a.w + padding <= b.x ||
    b.x + b.w + padding <= a.x ||
    a.y + a.h + padding <= b.y ||
    b.y + b.h + padding <= a.y
  );
}

/**
 * Visual Quality Scoring Engine for Poster Composition.
 * Evaluates candidate poster layout for safe-area compliance, text collisions,
 * alignment rhythm, and whitespace distribution.
 */
export function scorePosterLayout(layout: PosterLayout): {
  score: number;
  valid: boolean;
  issues: string[];
} {
  let score = 100;
  const issues: string[] = [];

  // Safe area checks
  const nameLh = layout.nameBlock.lineHeight ?? (layout.nameBlock.size * 1.05);
  const nameH = layout.nameBlock.measuredHeight ?? nameLh;
  const nameTop = layout.nameBlock.y - nameLh * 0.8;
  const nameBottom = nameTop + nameH;

  const roleLh = layout.roleBlock.lineHeight ?? (layout.roleBlock.size * 1.05);
  const roleH = layout.roleBlock.measuredHeight ?? roleLh;
  const roleTop = layout.roleBlock.y - roleLh * 0.8;
  const roleBottom = roleTop + roleH;

  const titleLh = layout.titleBlock.lineHeight ?? (layout.titleBlock.size * 1.25);
  const titleH = layout.titleBlock.measuredHeight ?? titleLh;
  const titleTop = layout.titleBlock.y - titleLh * 0.8;
  const titleBottom = titleTop + titleH;

  const photoBottom = layout.photo.y + layout.photo.h / 2;

  const maxCriticalY = Math.max(nameBottom, roleBottom, titleBottom, photoBottom);

  if (maxCriticalY > GRID.SAFE_CONTENT_BOTTOM + 20) {
    score -= 40;
    issues.push(`Critical content exceeds safe area (max Y: ${maxCriticalY.toFixed(0)} > ${GRID.SAFE_CONTENT_BOTTOM})`);
  }

  // Ocean wave check
  if (layout.waves.y < maxCriticalY - 20) {
    score -= 50;
    issues.push(`Waves cut into critical content (wave Y: ${layout.waves.y.toFixed(0)} < content Y: ${maxCriticalY.toFixed(0)})`);
  }

  // Name & Role gap check
  const nameToRoleGap = roleTop - nameBottom;
  if (nameToRoleGap < 4) {
    score -= 30;
    issues.push(`Name overlaps Role (gap: ${nameToRoleGap.toFixed(0)}px)`);
  }

  // Role & Title gap check
  const roleToTitleGap = titleTop - roleBottom;
  if (roleToTitleGap < 4) {
    score -= 30;
    issues.push(`Role overlaps Title (gap: ${roleToTitleGap.toFixed(0)}px)`);
  }

  // Alignment bonus
  if (layout.nameBlock.align === layout.roleBlock.align && layout.roleBlock.align === layout.titleBlock.align) {
    score += 10;
  }

  return {
    score,
    valid: score >= 60,
    issues,
  };
}
