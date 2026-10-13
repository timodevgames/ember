import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Meal } from '../../db/types';
import type { FoodItem } from '../../core/nutrition/foods';
import { useGame } from '../../state/game';
import { logFood, MEALS, mealForHour } from '../../state/food';
import PageHeader from '../../components/PageHeader';
import FoodSearch from './FoodSearch';
import AmountSheet from './AmountSheet';

export default function AddFoodPage() {
  const g = useGame();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [picked, setPicked] = useState<FoodItem | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  if (!g) return null;
  const day = params.get('day') ?? g.today;
  const meal = (params.get('meal') as Meal | null) ?? mealForHour(new Date(g.now).getHours());
  const mealLabel = MEALS.find((m) => m.key === meal)?.label ?? 'Food';
  const back = day === g.today ? '/food' : `/food?day=${day}`;

  return (
    <div className="pb-6">
      <PageHeader title={`Add to ${mealLabel}`} back={back} />
      {added && <p className="mb-3 rounded-xl bg-protein-400/15 px-3 py-2 text-sm text-protein-400">✓ {added} added — add more or go back.</p>}
      <FoodSearch onPick={setPicked} returnTo={`/food/add?${params}`} />
      <AmountSheet
        item={picked}
        meal={meal}
        onClose={() => setPicked(null)}
        onConfirm={async (item, grams, m) => {
          await logFood(day, m, item, grams);
          setPicked(null);
          if (m !== meal) nav(back);
          else setAdded(`${Math.round(grams)} g ${item.name}`);
        }}
      />
    </div>
  );
}
