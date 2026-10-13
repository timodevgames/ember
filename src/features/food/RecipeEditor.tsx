import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db } from '../../db/db';
import type { Recipe, RecipeItem } from '../../db/types';
import { scale, sumNutrients, type FoodItem } from '../../core/nutrition/foods';
import { deleteRecipe, saveRecipe } from '../../state/food';
import PageHeader from '../../components/PageHeader';
import Sheet from '../../components/Sheet';
import FoodSearch from './FoodSearch';
import AmountSheet from './AmountSheet';

/** A recipe is a saved list of ingredients — e.g. "Protein shake" = whey + milk + banana. */
export default function RecipeEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const returnTo = params.get('return') ?? '/food';
  const [existing, setExisting] = useState<Recipe | null>(null);
  const [name, setName] = useState('');
  const [servings, setServings] = useState(1);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<FoodItem | null>(null);

  useEffect(() => {
    if (!id) return;
    db.recipes.get(id).then((r) => {
      if (!r) return;
      setExisting(r);
      setName(r.name);
      setServings(r.servings);
      setItems(r.items);
    });
  }, [id]);

  const total = sumNutrients(items.map((i) => scale(i.per100, i.grams)));
  const grams = items.reduce((a, i) => a + i.grams, 0);
  const valid = name.trim() && items.length > 0;

  return (
    <div className="space-y-4 pb-8">
      <PageHeader title={existing ? 'Edit recipe' : 'New recipe'} back={returnTo} />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe name, e.g. Protein shake" className="w-full rounded-xl border border-night-600 bg-night-800 px-3 py-3" aria-label="Recipe name" />

      <section className="card divide-y divide-night-700">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{it.name}</span>
              <span className="text-xs text-zinc-500">
                {it.grams} g · {Math.round(scale(it.per100, it.grams).protein)} g protein
              </span>
            </span>
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="px-2 text-hp-400" aria-label={`Remove ${it.name}`}>
              ✕
            </button>
          </div>
        ))}
        <button onClick={() => setSearching(true)} className="w-full px-4 py-3 text-left font-semibold text-ember-400">
          + Add ingredient
        </button>
      </section>

      <label className="flex items-center justify-between text-sm">
        <span>Makes how many portions?</span>
        <input type="number" min={1} max={20} value={servings} onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))} className="w-20 rounded-xl border border-night-600 bg-night-800 px-3 py-2" />
      </label>

      {items.length > 0 && (
        <p className="rounded-xl bg-night-800 px-3 py-2 text-sm text-zinc-300">
          Whole recipe: {Math.round(grams)} g · {Math.round(total.kcal)} kcal · <b className="text-protein-400">{Math.round(total.protein)} g protein</b>
          {servings > 1 && (
            <>
              <br />
              Per portion: {Math.round(total.kcal / servings)} kcal · {Math.round(total.protein / servings)} g protein
            </>
          )}
        </p>
      )}

      <div className="flex gap-2">
        {existing && (
          <button
            onClick={async () => {
              await deleteRecipe(existing.id);
              nav(returnTo, { replace: true });
            }}
            className="rounded-2xl bg-hp-500/15 px-5 py-3.5 font-semibold text-hp-400"
          >
            Delete
          </button>
        )}
        <button
          disabled={!valid}
          onClick={async () => {
            const r = await saveRecipe({ id: existing?.id, name: name.trim(), servings, items, favorite: existing?.favorite });
            const sep = returnTo.includes('?') ? '&' : '?';
            nav(existing ? returnTo : `${returnTo}${sep}pick=${encodeURIComponent(r.id)}`, { replace: true });
          }}
          className="flex-1 rounded-2xl bg-ember-500 py-3.5 font-bold text-night-950 disabled:opacity-40"
        >
          Save recipe
        </button>
      </div>

      <Sheet open={searching} onClose={() => setSearching(false)} title="Add ingredient">
        <FoodSearch onPick={setPicked} returnTo={`/food/recipe/${existing?.id ?? 'new'}?${params}`} allowRecipes={false} />
      </Sheet>
      <AmountSheet
        item={picked}
        hideMeal
        confirmLabel="Add ingredient"
        onClose={() => setPicked(null)}
        onConfirm={(item, g) => {
          setItems([...items, { foodId: item.id, name: item.name, grams: g, per100: item.per100 }]);
          setPicked(null);
          setSearching(false);
        }}
      />
    </div>
  );
}
