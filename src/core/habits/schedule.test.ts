import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, logicalDay, weekday, weekStart } from '../date';
import type { Habit, HabitLog } from '../../db/types';
import { dueInfo, indexLogs, scheduleLabel } from './schedule';
import { habitStats } from './stats';

const MON = '2026-10-12';

function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: 'h',
    updatedAt: 0,
    name: 'Workout',
    icon: '💪',
    category: 'body',
    kind: 'check',
    target: 1,
    schedule: { type: 'perWeek', times: 3 },
    difficulty: 'medium',
    order: 0,
    createdDay: '2026-10-05',
    ...over,
  };
}
const log = (day: string, value = 1, source: HabitLog['source'] = 'manual'): HabitLog => ({
  id: `${source}:${day}`,
  updatedAt: 0,
  habitId: 'h',
  day,
  value,
  source,
  createdAt: 0,
});

describe('dates', () => {
  it('a day starts at 04:00', () => {
    expect(logicalDay(new Date(2026, 9, 14, 1, 30).getTime())).toBe('2026-10-13');
    expect(logicalDay(new Date(2026, 9, 14, 4, 0).getTime())).toBe('2026-10-14');
    expect(logicalDay(new Date(2026, 9, 14, 1, 30).getTime(), 0)).toBe('2026-10-14');
  });
  it('survives the October DST switch', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(daysBetween('2026-10-24', '2026-10-27')).toBe(3);
  });
  it('weeks start on Monday', () => {
    expect(weekday('2026-10-13')).toBe(1);
    expect(weekStart('2026-10-18')).toBe(MON);
  });
});

describe('per-week habits', () => {
  it('stay open until skipping would make the goal impossible', () => {
    const idx = indexLogs([]);
    expect(dueInfo(habit(), addDays(MON, 3), idx).state).toBe('open'); // Thu: need 3, 4 days left
    expect(dueInfo(habit(), addDays(MON, 4), idx).state).toBe('due'); // Fri: need 3, 3 days left
  });
  it('done days count as due until the goal is met, then as bonus', () => {
    const idx = indexLogs([log(MON), log(addDays(MON, 1)), log(addDays(MON, 2)), log(addDays(MON, 3))]);
    expect(dueInfo(habit(), addDays(MON, 2), idx)).toEqual({ state: 'due', week: { done: 2, goal: 3 } });
    expect(dueInfo(habit(), addDays(MON, 3), idx).state).toBe('bonus');
    expect(dueInfo(habit(), addDays(MON, 4), idx).state).toBe('off');
  });
  it('scale down the goal in the week the habit was created', () => {
    const h = habit({ createdDay: addDays(MON, 4) }); // created Friday: 3 active days
    expect(dueInfo(h, addDays(MON, 4), indexLogs([])).week?.goal).toBe(1);
  });
});

describe('logs and stats', () => {
  it('manual and auto logs merge by max', () => {
    const idx = indexLogs([log(MON, 10), log(MON, 25, 'musicCoach')]);
    expect(idx.get('h')?.get(MON)).toBe(25);
  });
  it('streak, best streak and "don\'t miss twice"', () => {
    const h = habit({ schedule: { type: 'daily' }, createdDay: MON });
    const days = [0, 1, 2, 4, 5]; // missed Thu (3)
    const idx = indexLogs(days.map((i) => log(addDays(MON, i))));
    const s = habitStats(h, idx, addDays(MON, 6));
    expect(s.streak).toBe(2); // today (Sun) not done yet — doesn't break it
    expect(s.bestStreak).toBe(3);
    expect(s.completions).toBe(5);
    expect(s.missedYesterday).toBe(false);
    const s2 = habitStats(h, indexLogs([log(MON)]), addDays(MON, 2));
    expect(s2.missedYesterday).toBe(true);
  });
  it('strength grows with consistency', () => {
    const h = habit({ schedule: { type: 'daily' }, createdDay: '2026-08-01' });
    const logs: HabitLog[] = [];
    for (let d = '2026-08-01'; d <= '2026-09-29'; d = addDays(d, 1)) logs.push(log(d));
    const s = habitStats(h, indexLogs(logs), '2026-09-30');
    expect(s.strength).toBeGreaterThan(0.88); // ~60 perfect days ≈ "automatic"
  });
  it('labels schedules', () => {
    expect(scheduleLabel({ type: 'weekdays', days: [0, 1, 2, 3, 4] })).toBe('Weekdays');
    expect(scheduleLabel({ type: 'weekdays', days: [5, 6] })).toBe('Weekends');
    expect(scheduleLabel({ type: 'perWeek', times: 3 })).toBe('3× per week');
  });
});
