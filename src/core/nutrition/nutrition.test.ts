/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { bmr, computeTargets, trendAdvice } from './targets';
import { blsToItems, recipeToItem, scale, type FoodItem } from './foods';
import { normalize, searchFoods } from './search';
import { offToFood } from './off';
import { portionsFor } from './portions';
import { addDays } from '../date';

describe('targets', () => {
  it('Mifflin–St Jeor matches the textbook value', () => {
    // 10·70 + 6.25·180 − 5·17 + 5
    expect(bmr({ sex: 'male', age: 17, heightCm: 180, weightKg: 70 })).toBe(1745);
  });
  it('lean bulk: TDEE + 250 kcal, 1.8 g/kg protein, 25 % fat', () => {
    const t = computeTargets({ sex: 'male', age: 17, heightCm: 180, weightKg: 70, activity: 'moderate', goal: 'build' });
    expect(t.kcal).toBe(2950); // 1745 × 1.55 + 250 = 2954.75 → nearest 10
    expect(t.protein).toBe(126);
    expect(t.proteinRange).toEqual([112, 154]);
    expect(t.fat).toBe(Math.round((2950 * 0.25) / 9));
    expect(t.protein * 4 + t.fat * 9 + t.carbs * 4).toBeGreaterThan(2930);
  });
  it('never plans below resting needs', () => {
    const t = computeTargets({ sex: 'female', age: 16, heightCm: 155, weightKg: 45, activity: 'sedentary', goal: 'lose' });
    expect(t.kcal).toBeGreaterThanOrEqual(Math.round(t.bmr * 1.1 / 10) * 10);
  });
  it('weight trend advice after two weeks', () => {
    const pts = Array.from({ length: 15 }, (_, i) => ({ day: addDays('2026-09-01', i), kg: 70 + i * 0.01 }));
    expect(trendAdvice(pts, 'build')?.kcalAdjust).toBe(100); // ~+0.07 kg/week → eat a bit more
    const fast = pts.map((p, i) => ({ ...p, kg: 70 + i * 0.15 }));
    expect(trendAdvice(fast, 'build')?.kcalAdjust).toBe(-100);
    expect(trendAdvice(pts.slice(0, 5), 'build')).toBeNull();
  });
});

describe('foods & search', () => {
  const bls = blsToItems(JSON.parse(readFileSync('public/data/foods-bls.json', 'utf8')));

  it('BLS import has sane values', () => {
    expect(bls.length).toBeGreaterThan(7000);
    const chicken = bls.find((f) => f.name === 'Hähnchen Brustfilet, roh')!;
    expect(chicken.per100.protein).toBeCloseTo(23.3, 1);
    const oats = bls.find((f) => f.name === 'Hafer Flocken')!;
    expect(oats.per100.protein).toBeGreaterThan(12);
    expect(oats.servings[0].grams).toBe(60);
  });

  it('finds compounds, umlauts and English names', () => {
    expect(searchFoods(bls, 'haferflocken')[0].name).toBe('Hafer Flocken');
    expect(searchFoods(bls, 'hahnchen brust').slice(0, 5).some((f) => f.name.startsWith('Hähnchen Brust'))).toBe(true);
    expect(searchFoods(bls, 'chicken breast').slice(0, 5).some((f) => f.name.startsWith('Hähnchen Brust'))).toBe(true);
    expect(searchFoods(bls, 'banane')[0].name).toBe('Banane roh');
    expect(searchFoods(bls, 'magerquark').slice(0, 3).some((f) => f.name.includes('Magerquark'))).toBe(true);
  });

  it('own foods and favourites rank first', () => {
    const mine: FoodItem = { id: 'custom:1', source: 'custom', name: 'Mein Protein Shake', per100: { kcal: 80, protein: 12, carbs: 4, fat: 1 }, servings: [] };
    expect(searchFoods([...bls, mine], 'protein')[0].id).toBe('custom:1');
  });

  it('normalizes', () => {
    expect(normalize('Hähnchen-Brust, Groß')).toBe('hahnchen brust, gross');
  });

  it('scales and builds recipes', () => {
    expect(scale({ kcal: 109, protein: 23.3, carbs: 0, fat: 1.8 }, 150)).toEqual({ kcal: 163.5, protein: 35, carbs: 0, fat: 2.7 });
    const r = recipeToItem({
      id: 'r',
      updatedAt: 0,
      name: 'Shake',
      servings: 1,
      items: [
        { foodId: 'a', name: 'Whey', grams: 30, per100: { kcal: 400, protein: 80, carbs: 6, fat: 6 } },
        { foodId: 'b', name: 'Milk', grams: 300, per100: { kcal: 64, protein: 3.4, carbs: 4.8, fat: 3.5 } },
      ],
    });
    expect(r.servings[0].grams).toBe(330);
    expect(scale(r.per100, 330).protein).toBeCloseTo(34.2, 0);
  });

  it('portion table', () => {
    expect(portionsFor('Banane roh')[0]).toEqual({ label: '1 banana', grams: 120 });
    expect(portionsFor('Something else')).toEqual([]);
  });
});

describe('open food facts mapping', () => {
  it('maps a product, falling back from kJ to kcal', () => {
    const f = offToFood({ code: '123', product_name: 'Skyr', brands: 'Milbona, Lidl', nutriments: { 'energy-kj_100g': 259, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 }, serving_quantity: 150, serving_size: '150 g' })!;
    expect(f.per100.kcal).toBe(62);
    expect(f.brand).toBe('Milbona');
    expect(f.servings?.[0]).toEqual({ label: '1 serving (150 g)', grams: 150 });
  });
  it('rejects products without protein or energy', () => {
    expect(offToFood({ code: '1', product_name: 'x', nutriments: { proteins_100g: 3 } })).toBeNull();
  });
});
