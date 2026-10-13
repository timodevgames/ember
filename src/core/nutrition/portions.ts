import type { Serving } from '../../db/types';

/**
 * Typical portions for staples, matched on the (German) food name, because
 * BLS only gives values per 100 g. First match wins.
 */
const RULES: [RegExp, Serving[]][] = [
  [/^(hühner)?ei\b|^ei (gekocht|roh|gebraten)|^hühnerei/i, [{ label: '1 egg (M)', grams: 58 }, { label: '2 eggs', grams: 116 }]],
  [/^banane/i, [{ label: '1 banana', grams: 120 }]],
  [/^apfel/i, [{ label: '1 apple', grams: 150 }]],
  [/^(orange|apfelsine)/i, [{ label: '1 orange', grams: 160 }]],
  [/^kiwi/i, [{ label: '1 kiwi', grams: 75 }]],
  [/toastbrot|^toast/i, [{ label: '1 slice', grams: 25 }]],
  [/^(brot|roggen|weizen|vollkorn|misch)[a-zä]* ?brot|^brot/i, [{ label: '1 slice', grams: 50 }]],
  [/brötchen|semmel/i, [{ label: '1 roll', grams: 60 }]],
  [/^hafer flocken|haferflocken/i, [{ label: '1 bowl', grams: 60 }]],
  [/^reis.*(roh)|^reis (poliert|unpoliert|parboiled)/i, [{ label: '1 portion (dry)', grams: 75 }]],
  [/^reis.*gekocht/i, [{ label: '1 portion', grams: 200 }]],
  [/^(teigwaren|nudeln|spaghetti).*roh/i, [{ label: '1 portion (dry)', grams: 100 }]],
  [/^(teigwaren|nudeln|spaghetti).*gekocht/i, [{ label: '1 portion', grams: 230 }]],
  [/^kartoffel/i, [{ label: '1 potato', grams: 90 }, { label: '1 portion', grams: 250 }]],
  [/hähnchen brust|putenbrust|puten brust/i, [{ label: '1 fillet', grams: 150 }]],
  [/^(speise)?quark|magerquark/i, [{ label: '1 tub', grams: 250 }, { label: '1 tbsp', grams: 30 }]],
  [/^skyr/i, [{ label: '1 tub', grams: 450 }, { label: '1 bowl', grams: 200 }]],
  [/joghurt/i, [{ label: '1 cup', grams: 150 }]],
  [/milch\b|^vollmilch|^milch/i, [{ label: '1 glass (200 ml)', grams: 206 }, { label: '1 cup (250 ml)', grams: 258 }]],
  [/käse|gouda|emmentaler|edamer/i, [{ label: '1 slice', grams: 25 }]],
  [/^butter\b/i, [{ label: '1 tsp', grams: 5 }, { label: '1 tbsp', grams: 12 }]],
  [/öl\b|^(oliven|raps|sonnenblumen)öl/i, [{ label: '1 tbsp', grams: 10 }]],
  [/^(erdnuss|mandel|haselnuss|walnuss|cashew)/i, [{ label: '1 handful', grams: 25 }]],
  [/thunfisch/i, [{ label: '1 can (drained)', grams: 130 }]],
  [/lachs/i, [{ label: '1 fillet', grams: 125 }]],
  [/molkenprotein|whey|proteinpulver|eiweißpulver/i, [{ label: '1 scoop', grams: 30 }]],
];

export function portionsFor(name: string): Serving[] {
  for (const [re, s] of RULES) if (re.test(name)) return s;
  return [];
}
