import type { Day } from '../date';
import type { FoodLog, Habit, HabitLog, PetSettings, Purchase, Vacation } from '../../db/types';
import { indexLogs, type LogIndex } from '../habits/schedule';
import { itemsForDay, type ItemContext, type NutritionDay, type NutritionGoals } from './items';
import { replay, type GameState } from './engine';
import { wornCosmetics } from './cosmetics';

/**
 * Raw records → everything the game needs. Pure, so the app (GameProvider) and
 * the server (push reminders) compute exactly the same pet state.
 */
export interface GameSources {
  habits: Habit[];
  habitLogs: HabitLog[];
  purchases: Purchase[];
  vacations: Vacation[];
  foodLogs: FoodLog[];
  pet: PetSettings | null;
  goals: NutritionGoals | null;
}

export interface ComputedGame {
  habits: Habit[];
  logs: LogIndex;
  purchases: Purchase[];
  vacations: Vacation[];
  nutritionFor: (day: Day) => NutritionDay;
  itemCtx: ItemContext;
  game: GameState | null;
  /** `${habitId}:${day}` where an auto-check (Music Coach, Valorant, GD) logged progress. */
  autoSet: Set<string>;
  /** Cosmetics the pet wears — equipped and owned. */
  worn: { hat?: string; bg?: string };
}

const alive = <T extends { deleted?: 0 | 1 }>(rows: T[]) => rows.filter((r) => !r.deleted);

export function summarizeFood(logs: FoodLog[]): Map<Day, NutritionDay> {
  const out = new Map<Day, NutritionDay & { mealSet: Set<string> }>();
  for (const l of logs) {
    let d = out.get(l.day);
    if (!d) out.set(l.day, (d = { kcal: 0, protein: 0, meals: 0, mealSet: new Set() }));
    d.kcal += l.nutrients.kcal;
    d.protein += l.nutrients.protein;
    d.mealSet.add(l.meal);
    d.meals = d.mealSet.size;
  }
  return out;
}

export function computeGame(src: GameSources, today: Day): ComputedGame {
  const habits = alive(src.habits).sort((a, b) => a.order - b.order);
  const liveLogs = alive(src.habitLogs);
  const logs = indexLogs(liveLogs);
  const autoSet = new Set(liveLogs.filter((l) => l.source !== 'manual' && l.value > 0).map((l) => `${l.habitId}:${l.day}`));
  const nutrition = summarizeFood(alive(src.foodLogs));
  const nutritionFor = (day: Day): NutritionDay => nutrition.get(day) ?? { kcal: 0, protein: 0, meals: 0 };
  const itemCtx: ItemContext = { habits, logs, nutritionGoals: src.goals, nutritionFor };
  const purchases = alive(src.purchases);
  const vacations = alive(src.vacations);
  const game = src.pet
    ? replay({
        startDay: src.pet.startDay <= today ? src.pet.startDay : today,
        today,
        itemsFor: (d) => itemsForDay(d, itemCtx),
        purchases,
        vacations,
      })
    : null;
  return { habits, logs, purchases, vacations, nutritionFor, itemCtx, game, autoSet, worn: wornCosmetics(src.pet?.equipped, purchases) };
}
