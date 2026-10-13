import { addDays } from '../date';
import type { Habit, HabitLog } from '../../db/types';
import { indexLogs } from '../habits/schedule';
import { itemsForDay, type NutritionDay } from './items';
import { replay } from './engine';
import { RULES, stageIndexFor, type Rules } from './rules';

/** Simulates a habit setup like Timo's at a given consistency. Used by balance.test.ts. */
export const START = '2026-01-05';

const H = (id: string, over: Partial<Habit>): Habit => ({
  id, updatedAt: 0, name: id, icon: '', category: 'other', kind: 'check', target: 1,
  schedule: { type: 'daily' }, difficulty: 'easy', order: 0, createdDay: START, ...over,
});

export const SETUP: Habit[] = [
  H('piano', { kind: 'duration', target: 15, difficulty: 'medium' }),
  H('valorant', {}),
  H('gd', {}),
  H('water', { kind: 'count', target: 8 }),
  H('workout', { schedule: { type: 'perWeek', times: 3 }, difficulty: 'hard' }),
];

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulate(p: number, days: number, seed = 1, rules: Rules = RULES) {
  const r = rng(seed);
  const logs: HabitLog[] = [];
  const food = new Map<string, NutritionDay>();
  for (let i = 0; i < days; i++) {
    const day = addDays(START, i);
    for (const h of SETUP) {
      if (h.id === 'workout' && r() > 0.45) continue; // tries to work out ~3×/week
      if (r() < p) logs.push({ id: `${h.id}${day}`, updatedAt: 0, habitId: h.id, day, value: h.target, source: 'manual', createdAt: 0 });
    }
    food.set(day, { protein: r() < p ? 130 : 80, kcal: r() < p ? 2900 : 2000, meals: r() < p ? 3 : 1 });
  }
  const ctx = {
    habits: SETUP,
    logs: indexLogs(logs),
    nutritionGoals: { since: START, protein: 126, kcal: 2950, countCalories: true },
    nutritionFor: (d: string) => food.get(d) ?? { kcal: 0, protein: 0, meals: 0 },
    rules,
  };
  const g = replay({ startDay: START, today: addDays(START, days), itemsFor: (d) => itemsForDay(d, ctx), rules });
  const stageDays: number[] = [];
  let xp = 0;
  g.history.forEach((h, i) => {
    if (!h.away) xp += h.xp;
    const st = stageIndexFor(xp, rules);
    while (stageDays.length <= st) stageDays.push(i);
  });
  const ranAwayDay = g.history.findIndex((h) => h.events.some((e) => e.type === 'ranAway'));
  const scored = g.history.filter((h) => h.score !== null && h.kind !== 'today');
  return {
    stageDays,
    ranAwayDay,
    rescues: g.rescues,
    hp: g.hp,
    coins: g.coins + 0,
    avgXp: Math.round(g.history.reduce((a, h) => a + h.xp, 0) / g.history.length),
    avgScore: Math.round((scored.reduce((a, h) => a + (h.score ?? 0), 0) / scored.length) * 100),
    minHp: Math.min(...g.history.map((h) => h.hpAfter)),
  };
}
