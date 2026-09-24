export type Stars = 1 | 2 | 3;

export const STAR_WEIGHTS: Record<Stars, number> = { 1: 35, 2: 40, 3: 25 };
export const WARMUP_DRAWS = 4;

export function starsOf(value: unknown): Stars {
  return value === 2 || value === 3 ? value : 1;
}
