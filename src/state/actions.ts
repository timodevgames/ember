import { db } from '../db/db';
import { remove, save, type Draft } from '../db/repo';
import type { Habit, HabitLog, Purchase, Reward, Vacation } from '../db/types';
import type { Day } from '../core/date';
import { nowMs } from '../core/sandbox';

/** Manual logs have one fixed id per habit and day, so two devices merge into one record. */
export const manualLogId = (habitId: string, day: Day) => `m:${habitId}:${day}`;

export async function setHabitValue(habit: Habit, day: Day, value: number): Promise<void> {
  const id = manualLogId(habit.id, day);
  const existing = await db.habitLogs.get(id);
  await save<HabitLog>('habitLogs', {
    id,
    habitId: habit.id,
    day,
    value: Math.max(0, value),
    source: 'manual',
    createdAt: existing?.createdAt ?? nowMs(),
  });
}

export async function manualValue(habitId: string, day: Day): Promise<number> {
  const row = await db.habitLogs.get(manualLogId(habitId, day));
  return row && !row.deleted ? row.value : 0;
}

export async function saveHabit(h: Draft<Habit>): Promise<Habit> {
  if (h.order === undefined || h.order < 0) {
    const all = await db.habits.toArray();
    h = { ...h, order: all.reduce((m, x) => Math.max(m, x.order), -1) + 1 };
  }
  return save<Habit>('habits', h);
}

export async function deleteHabit(id: string): Promise<void> {
  await remove('habits', id);
}

export async function buy(itemId: string, name: string, cost: number, day: Day): Promise<void> {
  await save<Purchase>('purchases', { itemId, name, cost, day, createdAt: nowMs() });
}

export async function saveReward(r: Draft<Reward>): Promise<void> {
  await save<Reward>('rewards', r);
}

export async function deleteReward(id: string): Promise<void> {
  await remove('rewards', id);
}

export async function saveVacation(v: Draft<Vacation>): Promise<void> {
  await save<Vacation>('vacations', v);
}

export async function deleteVacation(id: string): Promise<void> {
  await remove('vacations', id);
}
