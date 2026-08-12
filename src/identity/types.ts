/**
 * Typed model for the Builder ID generation system.
 *
 * Everything the poster needs is derived deterministically from a seed
 * string (photo meta + name + role + roll counter). The layout lives in a
 * fixed design space — 1080 × 1350 — and is scaled at render/export time,
 * never authored against a browser viewport.
 *
 * Pipeline:
 *   BuilderInput ──hash──▶ seed string ──createRng──▶ variant + PosterLayout
 *   PosterLayout ──renderPoster──▶ canvas (preview / export)
 */

export type VariantId = 'A' | 'B' | 'C' | 'D';

/** Raw user input plus the deterministic roll counter for re-rolls. */
export interface BuilderInput {
  name: string;
  role: string;
  /** Stable photo signature — file name + size + mtime, NOT the blob URL. */
  photoMeta: string | null;
  roll: number;
}

/** The full generated identity — what GENERATE_COMPLETE carries. */
export interface Identity {
  seed: string; // full seed string (deterministic per input + roll)
  variant: VariantId;
  idNumber: string; // 3-digit builder number, seeded
  layout: PosterLayout;
}

/* ------------------------------------------------------------------ */
/* Layout model (all coordinates in the 1080 × 1350 design space)      */
/* ------------------------------------------------------------------ */

export type FontKind = 'display' | 'ui' | 'hand';

export interface TextBlock {
  text?: string; // rendered string (set by the layout builder)
  x: number; // anchor x
  y: number; // anchor y (baseline, or vertical center when anchor = 'middle')
  size: number;
  rotation: number;
  align: 'left' | 'center' | 'right';
  anchor: 'baseline' | 'middle';
  color: string;
  font: FontKind;
  italic?: boolean;
  weight?: number;
  maxWidth: number;
  maxLines?: number;
  letterSpacing?: number; // px, caps tracking for UI text
  uppercase?: boolean;
}

export interface TapePiece {
  x: number; // center
  y: number; // center
  rotation: number;
  w: number;
  h: number;
}

export interface PhotoPlacement {
  x: number; // center
  y: number; // center
  w: number;
  h: number;
  rotation: number;
  matInset: number; // warm paper mat margin around the photo
  tearSeed: number;
  tape: TapePiece[];
  label?: { text: string; x: number; y: number; rotation: number; color: string };
}

export interface WaveBand {
  y: number; // top of the printed wave zone
  colors: string[];
  amp: number;
  seed: number;
}

export interface SunMark {
  x: number;
  y: number;
  r: number;
  color: string;
  rays: number;
  seed: number;
}

export interface PalmMark {
  x: number; // trunk base
  y: number; // trunk base
  h: number;
  seed: number;
  lean: number; // 1 leans right, -1 leans left
  opacity: number;
}

export interface Stamp {
  x: number;
  y: number;
  r: number;
  rotation: number;
  color: string;
  text1: string;
  text2: string;
}

export type Mark =
  | { kind: 'arrow'; x: number; y: number; rotation: number; length: number; color: string }
  | { kind: 'underline'; x: number; y: number; w: number; rotation: number; color: string }
  | { kind: 'star'; x: number; y: number; r: number; rotation: number; color: string }
  | { kind: 'scribble'; x: number; y: number; w: number; rotation: number; color: string };

export interface TicketShape {
  x: number;
  y: number;
  w: number;
  h: number;
  perforationY: number;
  stubWidth: number;
  borderColor: string;
}

export interface PosterPalette {
  paper: string;
  paperDeep: string;
  ink: string;
  inkSoft: string;
  accent: string; // seeded primary accent (coral / ocean / teal)
  accent2: string;
  ocean: string;
  oceanLight: string;
  turquoise: string;
  sky: string;
  photoMat: string;
  photoPaper: string;
  tape: string;
  sun: string;
}

export interface PosterLayout {
  variant: VariantId;
  seed: number;
  name: string;
  role: string;
  idNumber: string;
  palette: PosterPalette;
  headerLeft: TextBlock;
  headerRight: TextBlock;
  footer: TextBlock[];
  nameBlock: TextBlock;
  roleBlock: TextBlock;
  ghost?: TextBlock; // giant type behind the photo (variant C)
  ghostText?: string; // the text drawn in the ghost block
  photo: PhotoPlacement;
  waves: WaveBand;
  sun?: SunMark;
  palms: PalmMark[];
  stamp: Stamp;
  marks: Mark[];
  ticket?: TicketShape;
}
