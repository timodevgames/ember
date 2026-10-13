import type { Food, Nutrients, Serving } from '../../db/types';

/**
 * Open Food Facts (ODbL) — packaged products by barcode or name.
 * Called straight from the browser for now (OFF allows CORS); the Pixel server
 * proxy with a proper User-Agent and shared cache comes with sync (phase 3).
 */
const BASE = 'https://world.openfoodfacts.org/api/v3/product';
const SEARCH = 'https://search.openfoodfacts.org/search';
const FIELDS = 'code,product_name,product_name_de,product_name_en,brands,nutriments,serving_size,serving_quantity,quantity';

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  product_name_en?: string;
  brands?: string | string[];
  nutriments?: Record<string, number | string | undefined>;
  serving_size?: string;
  serving_quantity?: number | string;
}

export type OffFood = Omit<Food, 'updatedAt' | 'deviceId'>;

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined;
};

export function offToFood(p: OffProduct): OffFood | null {
  const n = p.nutriments ?? {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === undefined) {
    const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
    if (kj !== undefined) kcal = Math.round(kj / 4.184);
  }
  const protein = num(n['proteins_100g']);
  if (kcal === undefined || protein === undefined || !p.code) return null;
  const per100: Nutrients = {
    kcal,
    protein,
    carbs: num(n['carbohydrates_100g']) ?? 0,
    fat: num(n['fat_100g']) ?? 0,
    fiber: num(n['fiber_100g']),
    sugar: num(n['sugars_100g']),
    salt: num(n['salt_100g']),
  };
  const servings: Serving[] = [];
  const sq = num(p.serving_quantity);
  if (sq && sq > 0) servings.push({ label: p.serving_size ? `1 serving (${p.serving_size})` : '1 serving', grams: sq });
  const brand = Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(',')[0];
  const name = (p.product_name_de || p.product_name || p.product_name_en || '').trim() || `Product ${p.code}`;
  return { id: `off:${p.code}`, source: 'off', name, brand: brand?.trim() || undefined, barcode: p.code, per100, servings };
}

export type LookupResult = { status: 'found'; food: OffFood } | { status: 'incomplete'; name?: string } | { status: 'notFound' } | { status: 'error'; message: string };

/**
 * With sync connected the Pixel server answers first (proper User-Agent, shared
 * 30-day cache); if it's unreachable we ask Open Food Facts directly.
 */
export async function lookupBarcode(code: string, signal?: AbortSignal, proxy?: { url: string; token: string } | null): Promise<LookupResult> {
  if (proxy) {
    try {
      const r = await fetch(`${proxy.url}/off/product`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ token: proxy.token, barcode: code }), signal });
      const j = (await r.json()) as { ok?: boolean; status?: number; product?: { status?: string; product?: OffProduct } | null };
      if (j.ok && j.product) return interpret(code, j.product);
      if (j.ok && j.status === 404) return { status: 'notFound' };
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
    }
  }
  try {
    const r = await fetch(`${BASE}/${encodeURIComponent(code)}?fields=${FIELDS}`, { signal });
    if (r.status === 404) return { status: 'notFound' };
    return interpret(code, (await r.json()) as { status?: string; product?: OffProduct });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return { status: 'error', message: navigator.onLine ? 'Open Food Facts is not reachable right now.' : 'You are offline.' };
  }
}

function interpret(code: string, d: { status?: string; product?: OffProduct }): LookupResult {
  if (d.status !== 'success' || !d.product) return { status: 'notFound' };
  const food = offToFood({ ...d.product, code: d.product.code ?? code });
  if (!food) return { status: 'incomplete', name: d.product.product_name_de || d.product.product_name };
  return { status: 'found', food };
}

export async function searchOff(query: string, signal?: AbortSignal): Promise<OffFood[]> {
  const url = `${SEARCH}?q=${encodeURIComponent(query)}&langs=de,en&page_size=25&fields=${FIELDS}`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`Open Food Facts search failed (HTTP ${r.status})`);
  const d = (await r.json()) as { hits?: OffProduct[] };
  return (d.hits ?? []).map(offToFood).filter((f): f is OffFood => f !== null);
}
