import type { Difficulty } from '../../db/types';

/**
 * Every balance number of the game lives here. The game state is never stored —
 * it is replayed from the logs — so changing a number here simply re-scores
 * all of history.
 */
export interface StageDef {
  key: string;
  name: string;
  /** Bond XP needed to reach this stage. */
  xp: number;
  tails: number;
  /** Visual size of the pet. */
  scale: number;
}

export interface FindDef {
  id: string;
  icon: string;
  name: string;
  weight: number;
  /** Bonus coins instead of an item. */
  coins?: number;
}

export interface Rules {
  difficultyWeight: Record<Difficulty, number>;
  xp: Record<Difficulty, number>;
  coinRatio: number;
  perfectDay: { xp: number; coins: number };
  hp: { max: number; start: number; bands: { min: number; delta: number }[] };
  streakMinScore: number;
  /** The day the egg arrives can heal but never cost HP. */
  firstDayGrace: boolean;
  freeze: { earnEvery: number; maxHeld: number; cost: number; protectBelow: number };
  /** Rescue quest after the pet ran away; `xpPosition` = where in the lower stage it lands (0 = start, 1 = end). */
  rescue: { days: number; minScore: number; returnHp: number; xpPosition: number };
  stages: StageDef[];
  finds: FindDef[];
  nutrition: { proteinMin: number; caloriesMin: number; mealsMin: number };
  /** Habit strength half-life in due days (≈ 90 % "automatic" after ~60 perfect days). */
  strengthHalfLife: number;
}

export const RULES: Rules = {
  difficultyWeight: { easy: 1, medium: 2, hard: 3 },
  xp: { easy: 10, medium: 20, hard: 30 },
  coinRatio: 0.5,
  perfectDay: { xp: 10, coins: 5 },
  hp: {
    max: 100,
    start: 100,
    bands: [
      { min: 0.8, delta: 10 },
      { min: 0.5, delta: 0 },
      { min: 0.2, delta: -10 },
      { min: 0, delta: -20 },
    ],
  },
  streakMinScore: 0.5,
  firstDayGrace: true,
  freeze: { earnEvery: 7, maxHeld: 2, cost: 150, protectBelow: 0.5 },
  rescue: { days: 3, minScore: 0.8, returnHp: 50, xpPosition: 0.5 },
  stages: [
    { key: 'egg', name: 'Egg', xp: 0, tails: 0, scale: 0.7 },
    { key: 'hatchling', name: 'Hatchling', xp: 100, tails: 1, scale: 0.72 },
    { key: 'kit', name: 'Kit', xp: 500, tails: 1, scale: 0.82 },
    { key: 'fox', name: 'Three-Tail', xp: 1500, tails: 3, scale: 0.9 },
    { key: 'spirit', name: 'Five-Tail Spirit', xp: 3500, tails: 5, scale: 0.96 },
    { key: 'legend', name: 'Nine-Tail Legend', xp: 8000, tails: 9, scale: 1 },
  ],
  finds: [
    { id: 'acorn', icon: '🌰', name: 'Acorn', weight: 28 },
    { id: 'mushroom', icon: '🍄', name: 'Mushroom', weight: 22 },
    { id: 'feather', icon: '🪶', name: 'Feather', weight: 16 },
    { id: 'coins', icon: '🪙', name: 'Coin pouch', weight: 18, coins: 25 },
    { id: 'gem', icon: '💎', name: 'Gem', weight: 10 },
    { id: 'star', icon: '🌟', name: 'Fallen star', weight: 6 },
  ],
  nutrition: { proteinMin: 0.9, caloriesMin: 0.9, mealsMin: 2 },
  strengthHalfLife: 18,
};

export function hpDelta(score: number, rules: Rules = RULES): number {
  for (const b of rules.hp.bands) if (score >= b.min) return b.delta;
  return rules.hp.bands[rules.hp.bands.length - 1].delta;
}

export function stageIndexFor(xp: number, rules: Rules = RULES): number {
  let idx = 0;
  rules.stages.forEach((s, i) => {
    if (xp >= s.xp) idx = i;
  });
  return idx;
}
