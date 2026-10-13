import type { GameState } from './engine';
import { RULES, type Rules } from './rules';

export type Mood = 'egg' | 'ecstatic' | 'happy' | 'content' | 'sad' | 'sick' | 'sleeping' | 'away';

export function petMood(g: GameState, hour: number): Mood {
  if (g.away) return 'away';
  if (g.stage === 0) return 'egg';
  if (g.hp < 25) return 'sick';
  if (hour >= 23 || hour < 6) return 'sleeping';
  if (g.today.perfect) return 'ecstatic';
  const sc = g.today.score ?? 1;
  if (g.hp >= 70 && sc >= 0.5) return 'happy';
  if (g.hp >= 40) return 'content';
  return 'sad';
}

export function moodLine(mood: Mood, name: string, g: GameState): string {
  switch (mood) {
    case 'egg':
      return g.bondXp > 60 ? `The egg is wobbling… ${name} is almost here!` : `Something is moving inside the egg. Keep it warm with your habits.`;
    case 'ecstatic':
      return `${name} is doing happy zoomies — a perfect day!`;
    case 'happy':
      return `${name} is wagging ${g.stage >= 3 ? 'all tails' : 'its tail'}.`;
    case 'content':
      return `${name} is fine, but would love a little more attention.`;
    case 'sad':
      return `${name} looks lonely. A few habits would cheer it up.`;
    case 'sick':
      return `${name} is weak (${g.hp} HP). If HP hits 0, it runs away to the forest.`;
    case 'sleeping':
      return `${name} is curled up asleep. Zzz…`;
    case 'away':
      return `${name} ran away to the forest. Complete the rescue quest to bring it home.`;
  }
}

/** Progress inside the current stage, 0..1 (1 at the final stage). */
export function stageProgress(bondXp: number, stage: number, rules: Rules = RULES): { into: number; span: number; ratio: number } {
  const cur = rules.stages[stage];
  const next = rules.stages[stage + 1];
  if (!next) return { into: bondXp - cur.xp, span: 0, ratio: 1 };
  const span = next.xp - cur.xp;
  const into = bondXp - cur.xp;
  return { into, span, ratio: Math.max(0, Math.min(1, into / span)) };
}

export type PetColor = 'ember' | 'arctic' | 'shadow' | 'moss' | 'gold';

export interface Palette {
  fur: string;
  furDark: string;
  belly: string;
  tip: string;
  glow: string;
  eye: string;
}

export const PALETTES: Record<PetColor, Palette & { label: string }> = {
  ember: { label: 'Ember', fur: '#f08a3e', furDark: '#c9612a', belly: '#fff1e2', tip: '#ffd36b', glow: '#ff9d3c', eye: '#2a1a12' },
  arctic: { label: 'Arctic', fur: '#dfe9f5', furDark: '#a9bcd6', belly: '#ffffff', tip: '#8fd3ff', glow: '#7cc8ff', eye: '#1c2a3a' },
  shadow: { label: 'Shadow', fur: '#5b4b8a', furDark: '#3f3366', belly: '#d9cff5', tip: '#c48bff', glow: '#a970ff', eye: '#f5e9ff' },
  moss: { label: 'Moss', fur: '#7aa35a', furDark: '#55783c', belly: '#f0f7e4', tip: '#d8f27a', glow: '#b6e35a', eye: '#1d2a14' },
  gold: { label: 'Gold', fur: '#e6b93c', furDark: '#b88a1f', belly: '#fff8dc', tip: '#fff3a0', glow: '#ffd84a', eye: '#2b2210' },
};
