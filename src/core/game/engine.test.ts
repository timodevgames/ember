import { describe, expect, it } from 'vitest';
import { addDays, type Day } from '../date';
import type { Habit, HabitLog, Purchase, Vacation } from '../../db/types';
import { indexLogs } from '../habits/schedule';
import { itemsForDay } from './items';
import { dayRandom, replay, type GameInput } from './engine';
import { RULES, type Rules } from './rules';

const START = '2026-01-05'; // a Monday

function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    updatedAt: 0,
    name: 'Piano',
    icon: '🎹',
    category: 'music',
    kind: 'check',
    target: 1,
    schedule: { type: 'daily' },
    difficulty: 'medium',
    order: 0,
    createdDay: START,
    ...over,
  };
}

function log(habitId: string, day: Day, value = 1): HabitLog {
  return { id: `m:${habitId}:${day}`, updatedAt: 0, habitId, day, value, source: 'manual', createdAt: 0 };
}

/** Logs for `pattern`, one char per day from START: x = done, . = missed. */
function logsFor(habitId: string, pattern: string, from = START): HabitLog[] {
  return [...pattern].flatMap((c, i) => (c === 'x' ? [log(habitId, addDays(from, i))] : []));
}

function run(habits: Habit[], logs: HabitLog[], today: Day, extra: Partial<GameInput> = {}) {
  const idx = indexLogs(logs);
  return replay({
    startDay: START,
    today,
    itemsFor: (d) => itemsForDay(d, { habits, logs: idx, rules: extra.rules }),
    ...extra,
  });
}

const dayN = (n: number) => addDays(START, n);

describe('replay', () => {
  it('perfect days keep HP full, give XP + perfect bonus and build the streak', () => {
    const g = run([habit()], logsFor('h1', 'xxxxx'), dayN(5));
    expect(g.hp).toBe(100);
    expect(g.streak).toBe(5);
    expect(g.perfectDays).toBe(5);
    // medium habit 20 XP + perfect-day 10 XP
    expect(g.bondXp).toBe(5 * 30);
    expect(g.stage).toBe(1); // hatched at 100
  });

  it('missed days cost HP and the pet runs away at 0 (the first day is a grace day)', () => {
    const g = run([habit()], [], dayN(7));
    const settled = g.history.filter((h) => h.kind === 'scored');
    expect(settled.map((h) => h.hpAfter)).toEqual([100, 80, 60, 40, 20, 0, 0]);
    expect(g.away).toBe(true);
    expect(g.history[5].events).toContainEqual({ type: 'ranAway' });
  });

  it('the first day can heal but never hurt', () => {
    const g = run([habit()], [], START);
    expect(g.today.projectedHpChange).toBe(0);
    expect(g.today.safeAt).toBeNull();
  });

  it('earns a freeze every 7-day streak and uses it automatically on a bad day', () => {
    const g = run([habit()], logsFor('h1', 'xxxxxxx.x'), dayN(9));
    const missed = g.history[7];
    expect(g.history[6].events).toContainEqual({ type: 'freezeEarned' });
    expect(missed.frozen).toBe(true);
    expect(missed.hpChange).toBe(0);
    expect(g.streak).toBe(8); // the frozen day neither breaks nor extends it
    expect(g.freezes).toBe(0);
  });

  it('rescue quest: 3 strong days bring the pet back at 50 HP, one stage lower', () => {
    const rules: Rules = {
      ...RULES,
      stages: RULES.stages.map((s, i) => ({ ...s, xp: [0, 20, 60, 120, 200, 400][i] })),
    };
    const h = habit({ difficulty: 'hard' }); // 30 XP + 10 perfect bonus
    const g = run([h], logsFor('h1', 'xxxx.....xxx'), dayN(12), { rules });
    const ran = g.history.findIndex((d) => d.events.some((e) => e.type === 'ranAway'));
    expect(ran).toBe(8); // day 0 is the grace day, but it was a good day anyway
    const rescued = g.history.find((d) => d.events.some((e) => e.type === 'rescued'));
    expect(rescued?.day).toBe(dayN(11));
    expect(g.away).toBe(false);
    expect(g.hp).toBe(50);
    expect(g.rescues).toBe(1);
    // 160 XP (stage 3) → lands halfway into stage 2 (60..120) = 90
    expect(g.bondXp).toBe(90);
    expect(g.stage).toBe(2);
  });

  it('a failed day resets rescue progress', () => {
    const g = run([habit()], logsFor('h1', '......xx.xx'), dayN(11));
    expect(g.away).toBe(true);
    expect(g.rescueProgress).toBe(2);
  });

  it('vacation days are paused: no HP loss, streak kept', () => {
    const vac: Vacation = { id: 'v', updatedAt: 0, from: dayN(3), to: dayN(5) };
    const g = run([habit()], logsFor('h1', 'xxx...x'), dayN(7), { vacations: [vac] });
    expect(g.hp).toBe(100);
    expect(g.streak).toBe(4);
    expect(g.history.filter((d) => d.kind === 'vacation')).toHaveLength(3);
  });

  it('days without due habits are rest days', () => {
    const h = habit({ schedule: { type: 'weekdays', days: [0, 2, 4] } }); // Mon, Wed, Fri
    const g = run([h], logsFor('h1', 'x.x.x'), dayN(7));
    expect(g.history.slice(0, 7).map((d) => d.kind)).toEqual(['scored', 'rest', 'scored', 'rest', 'scored', 'rest', 'rest']);
    expect(g.streak).toBe(3);
    expect(g.hp).toBe(100);
  });

  it("today credits XP right away but HP only as a projection", () => {
    const h2 = habit({ id: 'h2', name: 'Valorant', difficulty: 'easy' });
    const logs = [...logsFor('h1', 'xx'), ...logsFor('h2', 'xxx')];
    const g = run([habit(), h2], logs, dayN(2));
    expect(g.hp).toBe(100);
    // 2 perfect days × (20 + 10 + 10 bonus) + 10 today
    expect(g.bondXp).toBe(90);
    expect(g.today.score).toBeCloseTo(1 / 3);
    expect(g.today.projectedHpChange).toBe(-10);
    expect(g.today.safeAt).toBe(0.5);
  });

  it('purchases spend coins; a bought freeze is held', () => {
    const p: Purchase = { id: 'p', updatedAt: 0, itemId: 'freeze', name: 'Streak freeze', cost: 50, day: dayN(4), createdAt: 0 };
    const g = run([habit()], logsFor('h1', 'xxxxx'), dayN(5), { purchases: [p] });
    // 5 perfect days × (10 coins + 5 bonus + find) − 50
    expect(g.freezes).toBe(1);
    const earned = g.history.reduce((a, d) => a + d.coins, 0);
    expect(g.coins).toBe(earned - 50);
  });

  it('partial count progress gives partial score but no XP', () => {
    const h = habit({ kind: 'count', target: 8, unit: 'glasses' });
    const g = run([h], [log('h1', START, 4)], dayN(1));
    expect(g.history[0].score).toBe(0.5);
    expect(g.history[0].xp).toBe(0);
    expect(g.history[0].hpChange).toBe(0);
  });

  it('replays are deterministic', () => {
    expect(dayRandom('2026-03-01', 'find')).toBe(dayRandom('2026-03-01', 'find'));
    const a = run([habit()], logsFor('h1', 'xxxxxxxxxx'), dayN(10));
    const b = run([habit()], logsFor('h1', 'xxxxxxxxxx'), dayN(10));
    expect(a.inventory).toEqual(b.inventory);
    expect(a.coins).toBe(b.coins);
  });
});
