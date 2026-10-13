import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { alive } from '../../db/repo';
import { foodToItem, loadBls, recipeToItem, type FoodItem } from '../../core/nutrition/foods';
import type { FoodLog } from '../../db/types';

export interface FoodIndex {
  items: FoodItem[];
  byId: Map<string, FoodItem>;
  /** How often each food was logged recently — boosts search ranking. */
  usage: Map<string, number>;
  recent: FoodItem[];
  favorites: FoodItem[];
  mine: FoodItem[];
  blsLoaded: boolean;
  blsError: string | null;
}

/** Everything searchable: BLS (lazy) + scanned products + custom foods + recipes. */
export function useFoodIndex(): FoodIndex | null {
  const [bls, setBls] = useState<FoodItem[] | null>(null);
  const [blsError, setBlsError] = useState<string | null>(null);
  useEffect(() => {
    loadBls().then(setBls, (e: Error) => setBlsError(e.message));
  }, []);

  const data = useLiveQuery(async () => {
    const [foods, recipes, logs] = await Promise.all([
      db.foods.toArray(),
      db.recipes.toArray(),
      db.foodLogs.orderBy('updatedAt').reverse().limit(400).toArray(),
    ]);
    return { foods: alive(foods), recipes: alive(recipes), logs: alive(logs) as FoodLog[] };
  });

  return useMemo(() => {
    if (!data) return null;
    // Favourite markers for BLS foods share the BLS id and only carry the flag.
    const blsFav = new Set(data.foods.filter((f) => f.id.startsWith('bls:') && f.favorite).map((f) => f.id));
    const own = data.foods.filter((f) => !f.id.startsWith('bls:')).map(foodToItem);
    const recipes = data.recipes.map(recipeToItem);
    const blsItems = (bls ?? []).map((b) => (blsFav.has(b.id) ? { ...b, favorite: true } : b));
    const items = [...recipes, ...own, ...blsItems];
    const byId = new Map(items.map((i) => [i.id, i]));

    const usage = new Map<string, number>();
    const recentIds: string[] = [];
    for (const l of data.logs) {
      usage.set(l.foodId, (usage.get(l.foodId) ?? 0) + 1);
      if (!recentIds.includes(l.foodId)) recentIds.push(l.foodId);
    }
    const recent = recentIds.map((id) => byId.get(id)).filter((x): x is FoodItem => !!x).slice(0, 25);
    return {
      items,
      byId,
      usage,
      recent,
      favorites: items.filter((i) => i.favorite),
      mine: [...recipes, ...own.filter((f) => f.source === 'custom')],
      blsLoaded: !!bls,
      blsError,
    };
  }, [data, bls, blsError]);
}
