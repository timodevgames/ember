import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db } from '../../db/db';
import type { Food } from '../../db/types';
import { deleteFood, saveFood } from '../../state/food';
import PageHeader from '../../components/PageHeader';

type Form = { name: string; brand: string; kcal: string; protein: string; carbs: string; fat: string; sugar: string; servingLabel: string; servingGrams: string };

const EMPTY: Form = { name: '', brand: '', kcal: '', protein: '', carbs: '', fat: '', sugar: '', servingLabel: '', servingGrams: '' };

/** Create/edit your own food — also where an unknown barcode lands, so the label values can be typed in once. */
export default function CustomFoodEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const barcode = params.get('barcode') ?? undefined;
  const returnTo = params.get('return') ?? '/food';
  const [existing, setExisting] = useState<Food | null>(null);
  const [f, setF] = useState<Form>({ ...EMPTY, name: params.get('name') ?? '' });

  useEffect(() => {
    if (!id) return;
    db.foods.get(id).then((food) => {
      if (!food) return;
      setExisting(food);
      const s = food.servings?.[0];
      setF({
        name: food.name,
        brand: food.brand ?? '',
        kcal: String(food.per100.kcal),
        protein: String(food.per100.protein),
        carbs: String(food.per100.carbs),
        fat: String(food.per100.fat),
        sugar: food.per100.sugar !== undefined ? String(food.per100.sugar) : '',
        servingLabel: s?.label ?? '',
        servingGrams: s ? String(s.grams) : '',
      });
    });
  }, [id]);

  const n = (s: string) => Number(s.replace(',', '.'));
  const valid = f.name.trim() && f.kcal !== '' && f.protein !== '' && n(f.kcal) >= 0 && n(f.protein) >= 0;

  const submit = async () => {
    if (!valid) return;
    const food = await saveFood({
      id: existing?.id ?? (barcode ? `off:${barcode}` : `custom:${crypto.randomUUID()}`),
      source: barcode || existing?.source === 'off' ? 'off' : 'custom',
      name: f.name.trim(),
      brand: f.brand.trim() || undefined,
      barcode: barcode ?? existing?.barcode,
      per100: { kcal: n(f.kcal), protein: n(f.protein), carbs: n(f.carbs) || 0, fat: n(f.fat) || 0, sugar: f.sugar ? n(f.sugar) : undefined },
      servings: f.servingGrams && n(f.servingGrams) > 0 ? [{ label: f.servingLabel.trim() || '1 serving', grams: n(f.servingGrams) }] : [],
      favorite: existing?.favorite,
    });
    const sep = returnTo.includes('?') ? '&' : '?';
    nav(existing ? returnTo : `${returnTo}${sep}pick=${encodeURIComponent(food.id)}`, { replace: true });
  };

  const field = (key: keyof Form, label: string, unit?: string, numeric = true) => (
    <label className="block text-sm text-zinc-400">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input
          inputMode={numeric ? 'decimal' : 'text'}
          value={f[key]}
          onChange={(e) => setF({ ...f, [key]: e.target.value })}
          className="min-w-0 flex-1 rounded-xl border border-night-600 bg-night-800 px-3 py-2.5 text-zinc-100"
        />
        {unit && <span className="w-10 text-zinc-500">{unit}</span>}
      </div>
    </label>
  );

  return (
    <div className="space-y-4 pb-8">
      <PageHeader title={existing ? 'Edit food' : 'New food'} back={returnTo} />
      {barcode && (
        <p className="rounded-xl bg-night-800 px-3 py-2 text-sm text-zinc-300">
          Barcode <b>{barcode}</b> isn't in Open Food Facts yet (or has no nutrition data). Type the values from the label once — next time the scan finds it.
        </p>
      )}
      {field('name', 'Name', undefined, false)}
      {field('brand', 'Brand (optional)', undefined, false)}
      <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Per 100 g / 100 ml</p>
      <div className="grid grid-cols-2 gap-3">
        {field('kcal', 'Energy', 'kcal')}
        {field('protein', 'Protein', 'g')}
        {field('carbs', 'Carbs', 'g')}
        {field('fat', 'Fat', 'g')}
        {field('sugar', 'of which sugar', 'g')}
      </div>
      <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Portion (optional)</p>
      <div className="grid grid-cols-2 gap-3">
        {field('servingLabel', 'Name', undefined, false)}
        {field('servingGrams', 'Size', 'g')}
      </div>
      <div className="flex gap-2 pt-2">
        {existing && (
          <button
            onClick={async () => {
              await deleteFood(existing.id);
              nav(returnTo, { replace: true });
            }}
            className="rounded-2xl bg-hp-500/15 px-5 py-3.5 font-semibold text-hp-400"
          >
            Delete
          </button>
        )}
        <button onClick={submit} disabled={!valid} className="flex-1 rounded-2xl bg-ember-500 py-3.5 font-bold text-night-950 disabled:opacity-40">
          Save food
        </button>
      </div>
    </div>
  );
}
