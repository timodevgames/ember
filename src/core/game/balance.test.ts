import { describe, expect, it } from 'vitest';
import { simulate } from './balance.sim';

/**
 * Guards the game balance with a setup like Timo's (piano, Valorant, GD, water,
 * workout 3×/week + nutrition goals). If a rules.ts change breaks one of these,
 * the game got noticeably easier or harsher — decide on purpose.
 */
describe('balance', () => {
  const seeds = [1, 2, 3, 4, 5];

  it('a consistent player (~80 %) never loses the pet and evolves on schedule', () => {
    for (const s of seeds) {
      const r = simulate(0.8, 200, s);
      expect(r.ranAwayDay).toBe(-1);
      expect(r.stageDays[2]).toBeLessThanOrEqual(10); // Kit within ~a week
      expect(r.stageDays[3]).toBeGreaterThanOrEqual(15); // Three-Tail around week 3
      expect(r.stageDays[3]).toBeLessThanOrEqual(30);
      expect(r.stageDays[4]).toBeGreaterThanOrEqual(45); // Five-Tail ≈ two months
      expect(r.stageDays[4]).toBeLessThanOrEqual(75);
    }
  });

  it('even a perfect player needs months for the Legend', () => {
    const r = simulate(1, 220, 1);
    expect(r.stageDays[5]).toBeGreaterThanOrEqual(95);
    expect(r.stageDays[5]).toBeLessThanOrEqual(130);
  });

  it('doing about two thirds keeps the pet safe', () => {
    for (const s of seeds) expect(simulate(0.65, 180, s).ranAwayDay).toBe(-1);
  });

  it('real stakes: mostly skipping makes the pet run away within weeks', () => {
    for (const s of seeds) {
      const r = simulate(0.3, 60, s);
      expect(r.ranAwayDay).toBeGreaterThan(7);
      expect(r.ranAwayDay).toBeLessThanOrEqual(30);
    }
  });
});
