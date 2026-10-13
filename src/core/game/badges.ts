import type { GameState } from './engine';

/**
 * Badges are permanent: they are derived from the best values in history
 * (best streak, total perfect days …), which a bad week can't take away.
 */
export interface BadgeDef {
  id: string;
  icon: string;
  name: string;
  hint: string;
  earned: (g: GameState, extra: BadgeExtra) => boolean;
}

export interface BadgeExtra {
  rewardsBought: number;
  proteinDays: number;
}

const finds = (g: GameState) => Object.keys(g.inventory).filter((k) => g.inventory[k] > 0).length;

export const BADGES: BadgeDef[] = [
  { id: 'first-step', icon: '👣', name: 'First Step', hint: 'Complete your first habit', earned: (g) => g.completions >= 1 },
  { id: 'hatched', icon: '🐣', name: 'Hatched', hint: 'Hatch your egg', earned: (g) => g.stage >= 1 || g.rescues > 0 },
  { id: 'week', icon: '🔥', name: 'One Week Strong', hint: 'Reach a 7-day streak', earned: (g) => g.bestStreak >= 7 },
  { id: 'month', icon: '📅', name: 'Monthly Ritual', hint: 'Reach a 30-day streak', earned: (g) => g.bestStreak >= 30 },
  { id: 'formed', icon: '🧠', name: 'Habit Formed', hint: 'Reach a 66-day streak — the science number', earned: (g) => g.bestStreak >= 66 },
  { id: 'century', icon: '💯', name: 'Centurion', hint: 'Reach a 100-day streak', earned: (g) => g.bestStreak >= 100 },
  { id: 'perfect-1', icon: '⭐', name: 'Flawless', hint: 'Have a perfect day', earned: (g) => g.perfectDays >= 1 },
  { id: 'perfect-10', icon: '🌟', name: 'Perfectionist', hint: '10 perfect days', earned: (g) => g.perfectDays >= 10 },
  { id: 'perfect-50', icon: '✨', name: 'Unstoppable', hint: '50 perfect days', earned: (g) => g.perfectDays >= 50 },
  { id: 'three-tails', icon: '🦊', name: 'Three Tails', hint: 'Evolve into a Three-Tail', earned: (g) => g.stage >= 3 },
  { id: 'five-tails', icon: '🔮', name: 'Spirit Bond', hint: 'Evolve into a Five-Tail Spirit', earned: (g) => g.stage >= 4 },
  { id: 'legend', icon: '👑', name: 'Legend', hint: 'Evolve into the Nine-Tail Legend', earned: (g) => g.stage >= 5 },
  { id: 'comeback', icon: '🌲', name: 'Comeback', hint: 'Rescue your pet from the forest', earned: (g) => g.rescues >= 1 },
  { id: 'collector', icon: '🎒', name: 'Collector', hint: 'Find 5 different treasures', earned: (g) => finds(g) >= 5 },
  { id: 'gems', icon: '💎', name: 'Gem Hoarder', hint: 'Find 5 gems', earned: (g) => (g.inventory.gem ?? 0) >= 5 },
  { id: 'treat', icon: '🎁', name: 'Treat Yourself', hint: 'Redeem a real-life reward', earned: (_g, x) => x.rewardsBought >= 1 },
  { id: 'protein-7', icon: '🥩', name: 'Protein Pro', hint: 'Hit your protein goal on 7 days', earned: (_g, x) => x.proteinDays >= 7 },
  { id: 'protein-30', icon: '💪', name: 'Builder', hint: 'Hit your protein goal on 30 days', earned: (_g, x) => x.proteinDays >= 30 },
];
