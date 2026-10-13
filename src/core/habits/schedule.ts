import { addDays, weekday, weekStart, type Day } from '../date';
import type { Habit, HabitLog, Schedule } from '../../db/types';

/** habitId → day → best value logged that day (manual and auto logs merge by max). */
export type LogIndex = Map<string, Map<Day, number>>;

export function indexLogs(logs: HabitLog[]): LogIndex {
  const idx: LogIndex = new Map();
  for (const l of logs) {
    if (l.deleted) continue;
    let byDay = idx.get(l.habitId);
    if (!byDay) idx.set(l.habitId, (byDay = new Map()));
    byDay.set(l.day, Math.max(byDay.get(l.day) ?? 0, l.value));
  }
  return idx;
}

export function valueOn(idx: LogIndex, habitId: string, day: Day): number {
  return idx.get(habitId)?.get(day) ?? 0;
}

/** 0..1 — a check habit is all-or-nothing, count/duration give partial credit. */
export function progressOf(h: Habit, value: number): number {
  if (h.kind === 'check') return value > 0 ? 1 : 0;
  if (h.target <= 0) return value > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, value / h.target));
}

export function isActive(h: Habit, day: Day): boolean {
  if (h.deleted) return false;
  if (day < h.createdDay) return false;
  if (h.archivedDay && day >= h.archivedDay) return false;
  return true;
}

/**
 * - `due`: counts toward the day score.
 * - `bonus`: done although not required (extra XP, no score effect).
 * - `open`: a per-week habit that may still be done today but isn't forced yet.
 * - `off`: not scheduled today.
 */
export type DueState = 'due' | 'bonus' | 'open' | 'off' | 'inactive';

export interface DueInfo {
  state: DueState;
  /** Per-week habits: completions this week before today / goal for this week. */
  week?: { done: number; goal: number };
}

/** Per-week goal, scaled down in the week the habit was created. */
function weeklyGoal(h: Habit & { schedule: { type: 'perWeek'; times: number } }, day: Day): number {
  const ws = weekStart(day);
  if (h.createdDay <= ws) return h.schedule.times;
  const activeDays = 7 - weekday(h.createdDay);
  return Math.max(1, Math.round((h.schedule.times * activeDays) / 7));
}

export function dueInfo(h: Habit, day: Day, idx: LogIndex): DueInfo {
  if (!isActive(h, day)) return { state: 'inactive' };
  const done = progressOf(h, valueOn(idx, h.id, day)) >= 1;
  const s: Schedule = h.schedule;
  if (s.type === 'daily') return { state: 'due' };
  if (s.type === 'weekdays') {
    if (s.days.includes(weekday(day))) return { state: 'due' };
    return { state: done ? 'bonus' : 'off' };
  }
  // perWeek
  const goal = weeklyGoal(h as Habit & { schedule: { type: 'perWeek'; times: number } }, day);
  let before = 0;
  for (let d = weekStart(day); d < day; d = addDays(d, 1)) {
    if (d >= h.createdDay && progressOf(h, valueOn(idx, h.id, d)) >= 1) before++;
  }
  const week = { done: before, goal };
  if (done) return { state: before < goal ? 'due' : 'bonus', week };
  const need = goal - before;
  if (need <= 0) return { state: 'off', week };
  const daysLeft = 7 - weekday(day); // including today
  return { state: need >= daysLeft ? 'due' : 'open', week };
}

export function scheduleLabel(s: Schedule): string {
  if (s.type === 'daily') return 'Every day';
  if (s.type === 'perWeek') return `${s.times}× per week`;
  const names = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  if (s.days.length === 5 && [0, 1, 2, 3, 4].every((d) => s.days.includes(d))) return 'Weekdays';
  if (s.days.length === 2 && s.days.includes(5) && s.days.includes(6)) return 'Weekends';
  return [...s.days].sort().map((d) => names[d]).join(' ');
}

/** Average required completions per day — used for strength pacing. */
export function frequencyOf(s: Schedule): number {
  if (s.type === 'daily') return 1;
  if (s.type === 'weekdays') return s.days.length / 7;
  return s.times / 7;
}
