import { addDays, weekStart, type Day } from '../date';
import type { Habit } from '../../db/types';
import { RULES } from '../game/rules';
import { dueInfo, progressOf, valueOn, type LogIndex } from './schedule';

export interface HabitStats {
  streak: number;
  bestStreak: number;
  completions: number;
  /** 0..1 — exponentially smoothed consistency ("how automatic is it"). */
  strength: number;
  /** Due yesterday, missed, and due again today → "don't miss twice". */
  missedYesterday: boolean;
}

export function strengthLabel(s: number): string {
  if (s >= 0.9) return 'Automatic';
  if (s >= 0.6) return 'Solid';
  if (s >= 0.3) return 'Growing';
  return 'Fragile';
}

export function habitStats(h: Habit, idx: LogIndex, today: Day, halfLife = RULES.strengthHalfLife): HabitStats {
  const done = (d: Day) => progressOf(h, valueOn(idx, h.id, d)) >= 1;
  let streak = 0;
  let best = 0;
  let completions = 0;
  let strength = 0;
  const m = Math.pow(0.5, 1 / halfLife);
  const weekM = Math.pow(0.5, 7 / halfLife);

  if (h.schedule.type === 'perWeek') {
    // Strength per finished week (+ the current one once its goal is met).
    for (let ws = weekStart(h.createdDay); ws <= today; ws = addDays(ws, 7)) {
      let n = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws, i);
        if (d >= h.createdDay && d <= today && done(d)) n++;
      }
      const finished = addDays(ws, 6) < today;
      const goal = h.schedule.times;
      if (finished || n >= goal) strength = strength * weekM + Math.min(1, n / goal) * (1 - weekM);
    }
  }

  let running = 0;
  for (let d = h.createdDay; d <= today; d = addDays(d, 1)) {
    const isDone = done(d);
    if (isDone) completions++;
    const info = dueInfo(h, d, idx);
    if (info.state !== 'due') continue;
    if (h.schedule.type !== 'perWeek') {
      const p = progressOf(h, valueOn(idx, h.id, d));
      if (d < today || isDone) strength = strength * m + p * (1 - m);
    }
    if (isDone) {
      running++;
      best = Math.max(best, running);
    } else if (d < today) {
      running = 0;
    }
  }
  streak = running;

  const yesterday = addDays(today, -1);
  const missedYesterday =
    yesterday >= h.createdDay &&
    dueInfo(h, yesterday, idx).state === 'due' &&
    !done(yesterday) &&
    dueInfo(h, today, idx).state === 'due' &&
    !done(today);

  return { streak, bestStreak: best, completions, strength, missedYesterday };
}
