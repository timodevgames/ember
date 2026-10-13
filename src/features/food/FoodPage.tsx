import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { alive } from '../../db/repo';
import { addDays, prettyDay, type Day } from '../../core/date';
import { sumNutrients } from '../../core/nutrition/foods';
import { RULES } from '../../core/game/rules';
import type { FoodLog, Meal } from '../../db/types';
import { useGame } from '../../state/game';
import { copyMeal, deleteFoodLog, MEALS, updateFoodLog, type FoodGoals } from '../../state/food';
import Ring from '../../components/Ring';
import Bar from '../../components/Bar';
import Sheet from '../../components/Sheet';
import PageHeader from '../../components/PageHeader';

export default function FoodPage() {
  const g = useGame();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const today = g?.today ?? '';
  const day: Day = params.get('day') ?? today;
  const logs = useLiveQuery(async () => {
    if (!today) return null;
    const rows = await db.foodLogs.where('day').between(addDays(day, -7), day, true, true).toArray();
    return alive(rows);
  }, [day, today]);
  if (!g || !logs) return null;

  const goals = g.nutritionGoals as FoodGoals | null;
  const editable = day >= addDays(today, -1);
  const dayLogs = logs.filter((l) => l.day === day).sort((a, b) => a.createdAt - b.createdAt);
  const total = sumNutrients(dayLogs.map((l) => l.nutrients));
  const prevDay = addDays(day, -1);
  const setDay = (d: Day) => setParams(d === today ? {} : { day: d }, { replace: true });

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Food"
        right={
          <Link to="/food/goals" className="rounded-full bg-night-800 px-3.5 py-2 text-sm font-semibold">
            🎯 Goals & weight
          </Link>
        }
      />

      <div className="flex items-center justify-between">
        <button onClick={() => setDay(addDays(day, -1))} className="grid h-9 w-9 place-items-center rounded-full bg-night-800 text-lg" aria-label="Previous day">
          ‹
        </button>
        <span className="font-semibold">
          {prettyDay(day, today)}
          {!editable && <span className="ml-2 text-xs text-zinc-500">read-only</span>}
        </span>
        <button onClick={() => setDay(addDays(day, 1))} disabled={day >= today} className="grid h-9 w-9 place-items-center rounded-full bg-night-800 text-lg disabled:opacity-30" aria-label="Next day">
          ›
        </button>
      </div>

      {goals ? (
        <Summary total={total} goals={goals} />
      ) : (
        <Link to="/food/goals" className="card block p-5 text-center">
          <p className="text-3xl">🎯</p>
          <p className="mt-1 font-semibold">Set your calorie & protein targets</p>
          <p className="text-sm text-zinc-400">Takes 20 seconds. Hitting protein will feed your pet.</p>
        </Link>
      )}

      {MEALS.map((m) => {
        const entries = dayLogs.filter((l) => l.meal === m.key);
        const sub = sumNutrients(entries.map((e) => e.nutrients));
        const prev = logs.filter((l) => l.day === prevDay && l.meal === m.key);
        return (
          <section key={m.key} className="card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="text-xl">{m.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{m.label}</p>
                <p className="text-xs text-zinc-400">
                  {Math.round(sub.kcal)} kcal · {Math.round(sub.protein)} g protein
                </p>
              </div>
              {editable && (
                <Link to={`/food/add?meal=${m.key}&day=${day}`} className="grid h-9 w-9 place-items-center rounded-full bg-ember-500 text-xl font-bold text-night-950" aria-label={`Add to ${m.label}`}>
                  +
                </Link>
              )}
            </div>
            {entries.length > 0 && (
              <ul className="divide-y divide-night-700 border-t border-night-700">
                {entries.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => editable && setEditing(e)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{e.name}</span>
                        <span className="text-xs text-zinc-500">{Math.round(e.grams)} g</span>
                      </span>
                      <span className="shrink-0 text-right text-xs tabular-nums">
                        <span className="block text-zinc-300">{Math.round(e.nutrients.kcal)} kcal</span>
                        <span className="block text-protein-400">{Math.round(e.nutrients.protein)} g P</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {entries.length === 0 && editable && prev.length > 0 && (
              <button onClick={() => copyMeal(prev, day, m.key)} className="w-full border-t border-night-700 px-4 py-2.5 text-left text-sm text-ember-400">
                ↻ Same as {day === today ? 'yesterday' : 'the day before'} ({prev.length} item{prev.length > 1 ? 's' : ''}, {Math.round(sumNutrients(prev.map((p) => p.nutrients)).protein)} g protein)
              </button>
            )}
          </section>
        );
      })}

      {goals && <WeekProtein logs={logs} day={day} goal={goals.protein} />}

      <p className="px-1 text-xs text-zinc-500">
        Food data: BLS 4.0 (Max Rubner-Institut, CC BY 4.0) · Open Food Facts (ODbL).
      </p>

      <EntrySheet entry={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function Summary({ total, goals }: { total: { kcal: number; protein: number; carbs: number; fat: number }; goals: FoodGoals }) {
  const left = Math.round(goals.kcal - total.kcal);
  const proteinOk = total.protein >= goals.protein * RULES.nutrition.proteinMin;
  return (
    <section className="card space-y-4 p-4">
      <div className="flex items-center gap-4">
        <Ring value={total.kcal / goals.kcal} size={104} stroke={10} color={total.kcal > goals.kcal * 1.1 ? 'var(--color-gold-400)' : 'var(--color-ember-500)'}>
          <span>
            <span className="block text-xl font-extrabold tabular-nums">{Math.abs(left)}</span>
            <span className="block text-[10px] text-zinc-400">{left >= 0 ? 'kcal left' : 'kcal over'}</span>
          </span>
        </Ring>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-protein-400">Protein {proteinOk && '✓'}</span>
              <span className="text-sm tabular-nums">
                <b>{Math.round(total.protein)}</b> / {goals.protein} g
              </span>
            </div>
            <Bar value={total.protein} max={goals.protein} color="var(--color-protein-400)" height="h-3.5" label="Protein" />
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {proteinOk ? 'Goal reached — your pet is fed 🦊' : `${Math.max(0, Math.round(goals.protein * RULES.nutrition.proteinMin - total.protein))} g more to feed your pet`}
            </p>
          </div>
          <Macro label="Carbs" value={total.carbs} goal={goals.carbs} color="#60a5fa" />
          <Macro label="Fat" value={total.fat} goal={goals.fat} color="#fbbf24" />
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        {Math.round(total.kcal)} of {goals.kcal} kcal eaten
      </p>
    </section>
  );
}

function Macro({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  return (
    <div className="grid grid-cols-[3rem_1fr_4.5rem] items-center gap-2 text-xs">
      <span className="text-zinc-400">{label}</span>
      <Bar value={value} max={goal} color={color} height="h-1.5" label={label} />
      <span className="text-right tabular-nums text-zinc-400">
        {Math.round(value)}/{goal} g
      </span>
    </div>
  );
}

function WeekProtein({ logs, day, goal }: { logs: FoodLog[]; day: Day; goal: number }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6));
  const vals = days.map((d) => logs.filter((l) => l.day === d).reduce((a, l) => a + l.nutrients.protein, 0));
  const max = Math.max(goal * 1.25, ...vals);
  return (
    <section className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-300">Protein, last 7 days</h3>
      <div className="relative flex h-28 items-end gap-2">
        <div className="absolute inset-x-0 border-t border-dashed border-protein-400/60" style={{ bottom: `${(goal / max) * 100}%` }} aria-hidden />
        {vals.map((v, i) => (
          <div key={days[i]} className="flex h-full flex-1 flex-col justify-end">
            <div className="rounded-t-md" style={{ height: `${(v / max) * 100}%`, background: v >= goal * RULES.nutrition.proteinMin ? 'var(--color-protein-400)' : 'var(--color-night-600)' }} title={`${days[i]}: ${Math.round(v)} g`} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2 text-center text-[10px] text-zinc-500">
        {days.map((d) => (
          <span key={d} className="flex-1">
            {new Date(d + 'T12:00').toLocaleDateString('en-GB', { weekday: 'narrow' })}
          </span>
        ))}
      </div>
    </section>
  );
}

function EntrySheet({ entry, onClose }: { entry: FoodLog | null; onClose: () => void }) {
  const [grams, setGrams] = useState('');
  const [meal, setMeal] = useState<Meal>('snack');
  const [lastId, setLastId] = useState<string | null>(null);
  if (entry && entry.id !== lastId) {
    setLastId(entry.id);
    setGrams(String(Math.round(entry.grams)));
    setMeal(entry.meal);
  }
  return (
    <Sheet open={!!entry} onClose={onClose} title={entry?.name}>
      {entry && (
        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} className="w-28 rounded-xl border border-night-600 bg-night-800 px-3 py-2.5" aria-label="Amount in grams" />
            <span className="text-zinc-400">g</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MEALS.map((m) => (
              <button key={m.key} onClick={() => setMeal(m.key)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${meal === m.key ? 'bg-ember-500 text-night-950' : 'bg-night-800 text-zinc-300'}`}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await deleteFoodLog(entry.id);
                onClose();
              }}
              className="rounded-xl bg-hp-500/15 px-4 py-3 font-semibold text-hp-400"
            >
              Delete
            </button>
            <button
              onClick={async () => {
                const g = Number(grams.replace(',', '.'));
                if (g > 0) await updateFoodLog(entry, g, meal);
                onClose();
              }}
              className="flex-1 rounded-xl bg-ember-500 py-3 font-bold text-night-950"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
