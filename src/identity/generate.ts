import { createRng } from '../utils/seed';
import { buildPosterPalette } from './palette';
import { buildVariant } from './variants';
import type { BuilderInput, Identity, VariantId } from './types';

/**
 * Deterministic generation: the same (photo meta + name + role + roll)
 * always produces the identical Identity — variant, builder number, palette
 * accent, builder title and every layout detail. No Math.random anywhere in
 * this path.
 */

const VARIANTS: VariantId[] = ['A', 'B', 'C', 'D', 'E'];

export function seedStringFor(input: BuilderInput): string {
  const photo = input.photoMeta ?? 'nophoto';
  return `${photo}|${input.name.trim().toLowerCase()}|${input.role.trim().toLowerCase()}|roll:${input.roll}`;
}

/**
 * Role → builder-title vocabulary. The first category whose keyword appears
 * in the role wins; the title is then picked deterministically from that
 * category's list. Unmatched roles fall back to the general builder
 * vocabulary, so the title is always fun but never nonsense.
 */
const TITLE_CATEGORIES: Array<{ keys: string[]; titles: string[] }> = [
  {
    keys: ['data', 'analytics', 'analyst', 'dataset', 'metrics'],
    titles: ['Data Cartographer', 'Signal Alchemist', 'Pattern Cartographer', 'Metric Miner'],
  },
  {
    keys: ['ml', 'ai', 'model', 'machine', 'research', 'deep'],
    titles: ['Model Whisperer', 'Signal Engineer', 'Neural Tinkerer', 'Algorithm Alchemist'],
  },
  {
    keys: ['frontend', 'front-end', 'web', 'ui', 'ux', 'interface', 'design', 'react', 'css'],
    titles: ['Pixel Architect', 'Interface Tinkerer', 'Layout Alchemist', 'Brush & Byte Builder'],
  },
  {
    keys: ['backend', 'api', 'server', 'infra', 'infrastructure', 'devops', 'cloud', 'database', 'distributed'],
    titles: ['Systems Builder', 'API Alchemist', 'Shipwright', 'Backend Cartographer'],
  },
  {
    keys: ['security', 'cyber', 'threat', 'pentest', 'hack', 'sentinel'],
    titles: ['Threat Hunter', 'Systems Sentinel', 'Signal Guardian'],
  },
  {
    keys: ['mobile', 'ios', 'android', 'app'],
    titles: ['Pocket Architect', 'App Tinkerer', 'Handheld Alchemist'],
  },
  {
    keys: ['blockchain', 'web3', 'solidity', 'crypto', 'smart contract'],
    titles: ['Chain Weaver', 'Token Tinkerer', 'Ledger Alchemist'],
  },
  {
    keys: ['game', 'unity', 'unreal', 'play', 'gamedev'],
    titles: ['World Sculptor', 'Play Architect', 'Level Cartographer'],
  },
  {
    keys: ['product', 'pm ', 'founder', 'startup', 'entrepreneur', 'growth'],
    titles: ['Product Alchemist', 'Builder in Chief', 'Roadmap Cartographer'],
  },
  {
    keys: ['hardware', 'iot', 'embedded', 'firmware', 'robotics'],
    titles: ['Circuit Whisperer', 'Hardware Alchemist', 'Robot Tinkerer'],
  },
];

const GENERAL_TITLES = [
  'Systems Alchemist',
  'Code Tinkerer',
  'Signal Hunter',
  'Shipwright',
  'Pixel Pirate',
  'Sunshine Engineer',
  'Idea Alchemist',
  'Builder of Things',
];

function pickTitle(role: string, rng: () => number): string {
  const lower = role.toLowerCase();
  for (const cat of TITLE_CATEGORIES) {
    if (cat.keys.some((k) => lower.includes(k))) {
      return cat.titles[Math.floor(rng() * cat.titles.length)];
    }
  }
  return GENERAL_TITLES[Math.floor(rng() * GENERAL_TITLES.length)];
}

export function generateIdentity(input: BuilderInput): Identity {
  const seed = seedStringFor(input);
  const rng = createRng(seed);

  const variant = VARIANTS[Math.floor(rng() * VARIANTS.length)];
  const idNumber = String(Math.floor(rng() * 1000)).padStart(3, '0');
  const palette = buildPosterPalette(rng);

  const name = input.name.trim() || 'A. Builder';
  const role = input.role.trim() || 'Full-Stack Engineer';
  const title = pickTitle(role, rng);

  const layout = buildVariant(rng, { name, role, idNumber, title }, variant, palette);

  return { seed, variant, idNumber, title, layout };
}
