import type { FoodItem } from './foods';

/**
 * Small, dependency-free food search tuned for German food names:
 * - umlauts/ß fold to plain letters ("hahnchen" finds "Hähnchen"),
 * - spaces are ignored for compounds ("haferflocken" finds "Hafer Flocken"),
 * - German and English names are both searched.
 * ~7 000 BLS rows scan in a few ms, so no index is needed.
 */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%., ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Prepared {
  item: FoodItem;
  text: string;
  squashed: string;
  words: string[];
}

const cache = new WeakMap<FoodItem, Prepared>();

function prep(item: FoodItem): Prepared {
  let p = cache.get(item);
  if (!p) {
    const text = normalize(`${item.name} ${item.sub ?? ''}`);
    p = { item, text, squashed: text.replace(/[ ,.]/g, ''), words: text.split(/[ ,.]+/) };
    cache.set(item, p);
  }
  return p;
}

export interface SearchOptions {
  limit?: number;
  /** Food ids used recently/often → ranked higher. */
  boost?: Map<string, number>;
}

/** Words that mark processed variants — a plain "hähnchen" should prefer the raw/basic food. */
const DEMOTE = /(paniert|frittiert|gesusst|gebunden|mariniert|kuchen|torte|suppe|sosse|auflauf|platzchen|keks|riegel)/;

export function searchFoods(items: FoodItem[], query: string, opts: SearchOptions = {}): FoodItem[] {
  const q = normalize(query);
  if (!q) return [];
  const tokens = q.split(' ').filter(Boolean);
  const qSquashed = q.replace(/[ ,.]/g, '');
  const scored: { item: FoodItem; score: number }[] = [];

  for (const item of items) {
    const p = prep(item);
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      if (p.words.some((w) => w === t)) score += 30;
      else if (p.words.some((w) => w.startsWith(t))) score += 20;
      else if (p.text.includes(t)) score += 8;
      else if (p.squashed.includes(t)) score += 6;
      else {
        ok = false;
        break;
      }
    }
    if (!ok) {
      // whole query as one compound word ("haferflocken" → "hafer flocken")
      if (tokens.length === 1 && p.squashed.includes(qSquashed)) score = 15;
      else continue;
    }
    const name = normalize(item.name);
    const nameSquashed = name.replace(/[ ,.]/g, '');
    if (nameSquashed === qSquashed) score += 45; // "haferflocken" = "Hafer Flocken"
    else if (name.startsWith(q) || nameSquashed.startsWith(qSquashed)) score += 25;
    if (DEMOTE.test(p.text) && !DEMOTE.test(q)) score -= 10;
    if (item.source !== 'bls') score += 12; // your own foods and scanned products first
    if (item.favorite) score += 15;
    score += Math.min(30, (opts.boost?.get(item.id) ?? 0) * 6);
    score -= Math.min(15, name.length / 6); // shorter, more basic names first
    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, opts.limit ?? 40).map((s) => s.item);
}
