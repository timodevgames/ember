import { describe, expect, it } from 'vitest';
import { addDays } from '../date';
import type { Habit, HabitLog, IntegrationStat } from '../../db/types';
import { indexLogs } from '../habits/schedule';
import { itemsForDay } from './items';
import { replay } from './engine';
import { weekRecap } from './recap';

const MON = '2026-10-05';
const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id, updatedAt: 0, name: id, icon: '•', category: 'other', kind: 'check', target: 1,
  schedule: { type: 'daily' }, difficulty: 'medium', order: 0, createdDay: '2026-09-28', ...over,
});
const log = (habitId: string, day: string): HabitLog => ({ id: `${habitId}${day}`, updatedAt: 0, habitId, day, value: 1, source: 'manual', createdAt: 0 });
const stat = (source: IntegrationStat['source'], day: string, data: Record<string, unknown>): IntegrationStat => ({ id: `stat:${source}:${day}`, updatedAt: 0, source, day, data });

describe('weekRecap', () => {
  const habits = [habit('piano'), habit('gd')];
  const logs: HabitLog[] = [];
  for (let i = 0; i < 7; i++) {
    logs.push(log('piano', addDays(MON, i)));
    if (i % 2 === 0) logs.push(log('gd', addDays(MON, i)));
  }
  const idx = indexLogs(logs);
  const today = addDays(MON, 8); // Tuesday of the next week
  const game = replay({ startDay: '2026-09-28', today, itemsFor: (d) => itemsForDay(d, { habits, logs: idx }) });

  it('summarises the finished week', () => {
    const r = weekRecap({
      weekStart: MON,
      today,
      game,
      habits,
      logs: idx,
      nutritionFor: () => ({ kcal: 0, protein: 0, meals: 0 }),
      goals: null,
      weights: [
        { id: 'w1', updatedAt: 0, day: MON, kg: 68 },
        { id: 'w2', updatedAt: 0, day: addDays(MON, 6), kg: 68.4 },
      ],
      stats: [
        stat('valorant', addDays(MON, 1), { matches: 3, minutes: 90, tier: 'Silver 2' }),
        stat('valorant', addDays(MON, 4), { matches: 2, minutes: 60, tier: 'Silver 3' }),
        stat('geometryDash', addDays(MON, -1), { stars: 400, diamonds: 1400, coins: 80, userCoins: 9, demons: 10, moons: 60, levels: 70 }),
        stat('geometryDash', addDays(MON, 6), { stars: 420, diamonds: 1470, coins: 80, userCoins: 9, demons: 11, moons: 60, levels: 72 }),
      ],
    });
    expect(r.days).toBe(7);
    expect(r.habits[0]).toMatchObject({ id: 'piano', done: 7, due: 7, rate: 1 });
    expect(r.habits[1]).toMatchObject({ id: 'gd', done: 4, due: 7 });
    expect(r.perfectDays).toBe(4);
    expect(r.avgScore).toBeCloseTo((4 * 1 + 3 * 0.5) / 7);
    expect(r.weight).toEqual({ start: 68, end: 68.4 });
    expect(r.valorant).toEqual({ matches: 5, hours: 2.5, rankStart: 'Silver 2', rankEnd: 'Silver 3' });
    expect(r.gd).toEqual({ stars: 20, diamonds: 70, demons: 1, levels: 2 });
    expect(r.musicMinutes).toBeNull();
  });

  it('only counts finished days of the current week', () => {
    const r = weekRecap({ weekStart: addDays(MON, 7), today, game, habits, logs: idx, nutritionFor: () => ({ kcal: 0, protein: 0, meals: 0 }), goals: null, weights: [], stats: [] });
    expect(r.days).toBe(1); // Monday is over, Tuesday (today) isn't
  });
});
