import { useEffect, useState } from 'react';
import type { Meal } from '../../db/types';
import { proteinDensity, scale, type FoodItem } from '../../core/nutrition/foods';
import { MEALS, toggleFavorite } from '../../state/food';
import Sheet from '../../components/Sheet';

interface Props {
  item: FoodItem | null;
  onClose: () => void;
  onConfirm: (item: FoodItem, grams: number, meal: Meal) => void;
  meal?: Meal;
  /** Hide the meal picker (recipe ingredient mode). */
  hideMeal?: boolean;
  confirmLabel?: string;
}

export default function AmountSheet({ item, onClose, onConfirm, meal: initialMeal = 'snack', hideMeal, confirmLabel = 'Add' }: Props) {
  const [grams, setGrams] = useState('100');
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [fav, setFav] = useState(false);
  useEffect(() => {
    if (!item) return;
    setGrams(String(item.servings[0]?.grams ?? 100));
    setMeal(initialMeal);
    setFav(!!item.favorite);
  }, [item, initialMeal]);
  if (!item) return null;

  const g = Number(grams.replace(',', '.')) || 0;
  const n = scale(item.per100, g);
  const density = proteinDensity(item.per100);
  const portions = [...item.servings, { label: '100 g', grams: 100 }];

  return (
    <Sheet open onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-tight">{item.name}</h2>
            {item.sub && <p className="text-sm text-zinc-400">{item.sub}</p>}
          </div>
          <button
            onClick={() => {
              setFav(!fav);
              toggleFavorite({ ...item, favorite: fav });
            }}
            className={`text-2xl ${fav ? 'text-gold-400' : 'text-zinc-500'}`}
            aria-label={fav ? 'Remove favourite' : 'Add favourite'}
            aria-pressed={fav}
          >
            {fav ? '★' : '☆'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {portions.map((p) => (
            <button
              key={p.label}
              onClick={() => setGrams(String(p.grams))}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${g === p.grams ? 'bg-ember-500 text-night-950' : 'bg-night-800 text-zinc-300'}`}
            >
              {p.label}
              {p.label !== '100 g' && <span className="ml-1 font-normal opacity-70">{p.grams} g</span>}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2">
          <input inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} className="w-28 rounded-xl border border-night-600 bg-night-800 px-3 py-2.5 text-lg" aria-label="Amount in grams" />
          <span className="text-zinc-400">g / ml</span>
        </label>

        <div className="grid grid-cols-4 gap-2 text-center">
          <Cell label="kcal" value={n.kcal} />
          <Cell label="protein" value={n.protein} unit="g" accent />
          <Cell label="carbs" value={n.carbs} unit="g" />
          <Cell label="fat" value={n.fat} unit="g" />
        </div>
        <p className="text-xs text-zinc-500">
          Per 100 g: {item.per100.kcal} kcal · {item.per100.protein} g protein
          {density >= 8 && <span className="ml-1 text-protein-400">· protein-rich 💪</span>}
        </p>

        {!hideMeal && (
          <div className="flex flex-wrap gap-1.5">
            {MEALS.map((m) => (
              <button key={m.key} onClick={() => setMeal(m.key)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${meal === m.key ? 'bg-night-600 text-zinc-100 ring-1 ring-ember-500' : 'bg-night-800 text-zinc-400'}`}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        )}

        <button disabled={g <= 0} onClick={() => onConfirm(item, g, meal)} className="w-full rounded-2xl bg-ember-500 py-3.5 font-bold text-night-950 disabled:opacity-40">
          {confirmLabel} · {Math.round(n.kcal)} kcal · {Math.round(n.protein)} g protein
        </button>
      </div>
    </Sheet>
  );
}

function Cell({ label, value, unit = '', accent }: { label: string; value: number; unit?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-night-800 py-2">
      <div className={`font-bold tabular-nums ${accent ? 'text-protein-400' : ''}`}>
        {Math.round(value)}
        {unit}
      </div>
      <div className="text-[10px] text-zinc-500">{label}</div>
    </div>
  );
}
