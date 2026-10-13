import { describe, expect, it } from 'vitest';
import type { Purchase } from '../../db/types';
import { COSMETICS, ownedCosmetics, sceneBackground, SCENES, wornCosmetics } from './cosmetics';
import { RULES } from './rules';

const buy = (itemId: string, deleted?: 0 | 1): Purchase => ({ id: itemId, updatedAt: 0, itemId, name: itemId, cost: 1, day: '2026-10-13', createdAt: 0, deleted });

describe('cosmetics', () => {
  it('owns only live cosmetic purchases', () => {
    const owned = ownedCosmetics([buy('cosmetic:hat-bow'), buy('cosmetic:hat-crown', 1), buy('freeze'), buy('reward:x')]);
    expect([...owned]).toEqual(['hat-bow']);
  });
  it('wears only what is still owned', () => {
    expect(wornCosmetics({ hat: 'hat-crown', bg: 'bg-forest' }, [buy('cosmetic:bg-forest')])).toEqual({ hat: undefined, bg: 'bg-forest' });
    expect(wornCosmetics(undefined, [])).toEqual({ hat: undefined, bg: undefined });
  });
  it('every scene has a background and every stage lock exists', () => {
    for (const c of COSMETICS) {
      if (c.kind === 'bg') expect(SCENES[c.id]).toBeTruthy();
      if (c.minStage !== undefined) expect(RULES.stages[c.minStage]).toBeTruthy();
    }
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length);
  });
  it('falls back to the default sky', () => {
    expect(sceneBackground(undefined, true, false)).toContain('#2a2148');
    expect(sceneBackground('bg-galaxy', false, true)).toContain('#0f2a22'); // away = forest, whatever is worn
  });
});
