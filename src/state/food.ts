import { db } from '../db/db';
import { remove, save, type Draft } from '../db/repo';
import { setSetting } from '../db/settings';
import type { Food, FoodLog, Meal, Recipe, WeightEntry } from '../db/types';
import type { Day } from '../core/date';
import { nowMs } from '../core/sandbox';
import { scale, type FoodItem } from '../core/nutrition/foods';
import type { NutritionGoals } from '../core/game/items';
import type { Profile, Targets } from '../core/nutrition/targets';
import type { OffFood } from '../core/nutrition/off';

export interface FoodGoals extends NutritionGoals {
  carbs: number;
  fat: number;
  proteinRange: [number, number];
  /** User typed their own numbers instead of the calculated ones. */
  manual?: boolean;
}

export const MEALS: { key: Meal; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { key: 'lunch', label: 'Lunch', icon: '🍝' },
  { key: 'dinner', label: 'Dinner', icon: '🍲' },
  { key: 'snack', label: 'Snacks', icon: '🍎' },
];

/** Default meal for "now", so the add button picks something sensible. */
export function mealForHour(h: number): Meal {
  if (h >= 4 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  if (h >= 17 && h < 22) return 'dinner';
  return 'snack';
}

export async function logFood(day: Day, meal: Meal, item: FoodItem, grams: number): Promise<void> {
  // Scanned products enter the local food list on first use so they're searchable offline.
  if (item.source === 'off' && !(await db.foods.get(item.id))) {
    await save<Food>('foods', { id: item.id, source: 'off', name: item.name, brand: item.sub, barcode: item.id.slice(4), per100: item.per100, servings: item.servings });
  }
  await save<FoodLog>('foodLogs', { day, meal, foodId: item.id, name: item.name, grams, nutrients: scale(item.per100, grams), createdAt: nowMs() });
}

export async function updateFoodLog(log: FoodLog, grams: number, meal: Meal): Promise<void> {
  const per100 = log.grams > 0 ? scale(log.nutrients, (100 / log.grams) * 100) : log.nutrients;
  await save<FoodLog>('foodLogs', { ...log, grams, meal, nutrients: scale(per100, grams) });
}

export async function deleteFoodLog(id: string): Promise<void> {
  await remove('foodLogs', id);
}

/** Copy all entries of one meal (e.g. yesterday's breakfast) to another day. */
export async function copyMeal(entries: FoodLog[], toDay: Day, meal: Meal): Promise<void> {
  for (const e of entries) {
    await save<FoodLog>('foodLogs', { day: toDay, meal, foodId: e.foodId, name: e.name, grams: e.grams, nutrients: e.nutrients, createdAt: nowMs() });
  }
}

export async function saveFood(f: Draft<Food>): Promise<Food> {
  return save<Food>('foods', f);
}

export async function cacheOffFood(f: OffFood): Promise<Food> {
  const existing = await db.foods.get(f.id);
  return save<Food>('foods', { ...f, favorite: existing?.favorite });
}

export async function deleteFood(id: string): Promise<void> {
  await remove('foods', id);
}

export async function saveRecipe(r: Draft<Recipe>): Promise<Recipe> {
  return save<Recipe>('recipes', r);
}

export async function deleteRecipe(id: string): Promise<void> {
  await remove('recipes', id);
}

/** Favourite any item; BLS foods get a lightweight custom copy to carry the flag. */
export async function toggleFavorite(item: FoodItem): Promise<void> {
  if (item.source === 'recipe') {
    const r = await db.recipes.get(item.id);
    if (r) await save<Recipe>('recipes', { ...r, favorite: r.favorite ? 0 : 1 });
    return;
  }
  const f = await db.foods.get(item.id);
  if (f && !f.deleted) {
    await save<Food>('foods', { ...f, favorite: f.favorite ? 0 : 1 });
    return;
  }
  // Not in the DB yet: BLS rows get a favourite marker with the same id, online products get cached.
  if (item.source === 'off') {
    await save<Food>('foods', { id: item.id, source: 'off', name: item.name, brand: item.sub, barcode: item.id.slice(4), per100: item.per100, servings: item.servings, favorite: 1 });
  } else {
    await save<Food>('foods', { id: item.id, source: 'custom', name: item.name, brand: item.sub, per100: item.per100, servings: [], favorite: 1 });
  }
}

export async function saveWeight(day: Day, kg: number): Promise<void> {
  await save<WeightEntry>('weights', { id: `w:${day}`, day, kg });
}

export async function saveGoals(profile: Profile, t: Targets, today: Day, existing: FoodGoals | null, manual?: Partial<Pick<FoodGoals, 'kcal' | 'protein'>>): Promise<void> {
  await setSetting<Profile>('profile', profile);
  const kcal = manual?.kcal ?? t.kcal;
  const protein = manual?.protein ?? t.protein;
  const fat = Math.round((kcal * 0.25) / 9);
  await setSetting<FoodGoals>('nutritionGoals', {
    // Keep the original start so earlier days are never re-scored.
    since: existing?.since ?? today,
    kcal,
    protein,
    fat,
    carbs: Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)),
    proteinRange: t.proteinRange,
    countCalories: existing?.countCalories ?? profile.goal === 'build',
    manual: !!manual && (manual.kcal !== undefined || manual.protein !== undefined),
  });
}
