import type { PosterPalette } from './types';

/**
 * The poster palette — a disciplined Goa print palette derived from the
 * site tokens. Green is grounding ink, blue owns the water, mango owns the
 * sun, coral owns human marks, cream is the paper.
 *
 * `buildPosterPalette` picks the *accent* (used for role underlines,
 * arrows, small marks) deterministically from a small set so two posters
 * stay in the same universe while still differing.
 */

export const PAPER_MAIN = '#f6edd2';
export const PAPER_DEEP = '#ecd9ab';

const ACCENTS = [
  { accent: '#e84e33', accent2: '#ff6a4d' }, // coral
  { accent: '#12597a', accent2: '#2a96b8' }, // ocean
  { accent: '#0c6e67', accent2: '#2bb5a9' }, // teal / turquoise
] as const;

export function buildPosterPalette(rng: () => number): PosterPalette {
  const acc = ACCENTS[Math.floor(rng() * ACCENTS.length)];
  return {
    paper: PAPER_MAIN,
    paperDeep: PAPER_DEEP,
    ink: '#0b2b1f',
    inkSoft: 'rgba(11, 43, 31, 0.55)',
    accent: acc.accent,
    accent2: acc.accent2,
    ocean: '#0d5b78',
    oceanLight: '#2a96b8',
    turquoise: '#2bb5a9',
    sky: '#bfe3ec',
    photoMat: '#f3e0b4',
    photoPaper: '#fbfcf7',
    tape: 'rgba(246, 228, 182, 0.9)',
    sun: '#ffb92e',
  };
}
