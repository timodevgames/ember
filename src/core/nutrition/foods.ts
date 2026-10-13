import type { Food, Nutrients, Recipe, Serving } from '../../db/types';
import { portionsFor } from './portions';

/** One searchable thing you can eat — from BLS, Open Food Facts, your own foods or recipes. */
export interface FoodItem {
  id: string;
  source: 'bls' | 'off' | 'custom' | 'recipe';
  name: string;
  /** Secondary line: English name, brand, "recipe" … */
  sub?: string;
  per100: Nutrients;
  servings: Serving[];
  favorite?: boolean;
}

export const NUTRIENT_KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'salt'] as const;

type BlsRow = [string, string, string, number, number, number, number, number, number, number];
interface BlsFile {
  foods: BlsRow[];
}

export function blsToItems(file: BlsFile): FoodItem[] {
  return file.foods.map(([code, de, en, kcal, protein, carbs, fat, fiber, sugar, salt]) => ({
    id: `bls:${code}`,
    source: 'bls',
    name: de,
    sub: en,
    per100: { kcal, protein, carbs, fat, fiber, sugar, salt },
    servings: portionsFor(de),
  }));
}

let blsPromise: Promise<FoodItem[]> | null = null;

/** Lazy-loads the bundled BLS table (~800 KB, precached by the service worker). */
export function loadBls(): Promise<FoodItem[]> {
  if (!blsPromise) {
    blsPromise = fetch(`${import.meta.env.BASE_URL}data/foods-bls.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`food table: HTTP ${r.status}`);
        return r.json() as Promise<BlsFile>;
      })
      .then(blsToItems)
      .catch((e) => {
        blsPromise = null;
        throw e;
      });
  }
  return blsPromise;
}

export function foodToItem(f: Food): FoodItem {
  return {
    id: f.id,
    source: f.source,
    name: f.name,
    sub: f.brand,
    per100: f.per100,
    servings: [...(f.servings ?? []), ...portionsFor(f.name)],
    favorite: !!f.favorite,
  };
}

export function recipeToItem(r: Recipe): FoodItem {
  const total = r.items.reduce((a, i) => a + i.grams, 0);
  const sums = sumNutrients(r.items.map((i) => scale(i.per100, i.grams)));
  const per100 = total > 0 ? scale(sums, 100 / total * 100) : sums;
  const portion = r.servings > 0 ? Math.round(total / r.servings) : total;
  return {
    id: r.id,
    source: 'recipe',
    name: r.name,
    sub: `Recipe · ${r.items.length} ingredients`,
    per100,
    servings: [{ label: r.servings > 1 ? '1 portion' : 'Whole recipe', grams: portion }],
    favorite: !!r.favorite,
  };
}

/** Nutrients for `grams` of a food given per 100 g. */
export function scale(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  const out = {} as Nutrients;
  for (const k of NUTRIENT_KEYS) {
    const v = per100[k];
    if (v !== undefined) out[k] = Math.round(v * f * 10) / 10;
  }
  return out;
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  const out: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0 };
  for (const n of list) for (const k of NUTRIENT_KEYS) out[k] = Math.round(((out[k] ?? 0) + (n[k] ?? 0)) * 10) / 10;
  return out;
}

/** Protein per 100 kcal — "how protein-dense is this?" (≥ 10 g is excellent). */
export function proteinDensity(n: Nutrients): number {
  return n.kcal > 0 ? (n.protein / n.kcal) * 100 : 0;
}
