import { createRng } from '../utils/seed';
import { buildPosterPalette } from './palette';
import { buildVariant } from './variants';
import type { BuilderInput, Identity, VariantId } from './types';

/**
 * Deterministic generation: the same (photo meta + name + role + roll)
 * always produces the identical Identity — variant, builder number, palette
 * accent and every layout detail. No Math.random anywhere in this path.
 */

const VARIANTS: VariantId[] = ['A', 'B', 'C', 'D'];

export function seedStringFor(input: BuilderInput): string {
  const photo = input.photoMeta ?? 'nophoto';
  return `${photo}|${input.name.trim().toLowerCase()}|${input.role.trim().toLowerCase()}|roll:${input.roll}`;
}

export function generateIdentity(input: BuilderInput): Identity {
  const seed = seedStringFor(input);
  const rng = createRng(seed);

  const variant = VARIANTS[Math.floor(rng() * VARIANTS.length)];
  const idNumber = String(Math.floor(rng() * 1000)).padStart(3, '0');
  const palette = buildPosterPalette(rng);

  const name = input.name.trim() || 'A. Builder';
  const role = input.role.trim() || 'Full-Stack Engineer';

  const layout = buildVariant(rng, { name, role, idNumber }, variant, palette);

  return { seed, variant, idNumber, layout };
}
