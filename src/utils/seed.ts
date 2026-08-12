/**
 * Deterministic seed utilities.
 *
 * The generation system (photo + name + role/stack) will hash those inputs
 * into a numeric seed, then use a seeded PRNG to vary composition details
 * (blob placement, wave phase, accent color pick, decorative density) while
 * staying within one coherent design system. Only the hashing + PRNG are
 * needed at the visual-foundation stage; the live background already
 * accepts a seed so later work can plug straight in.
 */

export function hashStringToSeed(input: string): number {
  let h = 2166136261 >>> 0; // FNV-1a offset basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 — small, fast, deterministic PRNG from a 32-bit seed. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(input: string) {
  return mulberry32(hashStringToSeed(input));
}
