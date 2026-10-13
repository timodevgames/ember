import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { alive } from '../../db/repo';
import { getSetting, setSetting } from '../../db/settings';
import { useGame } from '../../state/game';
import { saveGoals, saveWeight, type FoodGoals } from '../../state/food';
import { ACTIVITY, computeTargets, GOALS, trendAdvice, weightTrend, type Activity, type Goal, type Profile } from '../../core/nutrition/targets';
import PageHeader from '../../components/PageHeader';

// Body numbers start empty on purpose — guessed defaults would look like real data.
const DEFAULT: Profile = { sex: 'male', age: 0, heightCm: 0, weightKg: 0, activity: 'moderate', goal: 'build' };

export default function GoalsPage() {
  const g = useGame();
  const profile = useLiveQuery(() => getSetting<Profile | null>('profile', null));
  const weights = useLiveQuery(async () => alive(await db.weights.toArray()).sort((a, b) => a.day.localeCompare(b.day)));
  const [p, setP] = useState<Profile | null>(null);
  const [manual, setManual] = useState<{ kcal?: string; protein?: string }>({});
  const [weightDraft, setWeightDraft] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile !== undefined && !p) setP(profile ?? DEFAULT);
  }, [profile, p]);
  const goals = g?.nutritionGoals as FoodGoals | null | undefined;
  useEffect(() => {
    if (goals?.manual) setManual({ kcal: String(goals.kcal), protein: String(goals.protein) });
  }, [goals?.manual, goals?.kcal, goals?.protein]);

  if (!g || !p || !weights) return null;
  const t = computeTargets(p);
  const up = (patch: Partial<Profile>) => {
    setP({ ...p, ...patch });
    setSaved(false);
  };
  const advice = trendAdvice(weights, p.goal);
  const trend = weightTrend(weights);
  const latest = weights[weights.length - 1];

  const num = (key: 'age' | 'heightCm' | 'weightKg', label: string, unit: string) => (
    <label className="block text-sm text-zinc-400">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input inputMode="decimal" value={p[key] || ''} onChange={(e) => up({ [key]: Number(e.target.value.replace(',', '.')) || 0 })} className="min-w-0 flex-1 rounded-xl border border-night-600 bg-night-800 px-3 py-2.5 text-zinc-100" />
        <span className="text-zinc-500">{unit}</span>
      </div>
    </label>
  );

  const valid = p.age >= 10 && p.heightCm >= 100 && p.weightKg >= 25;
  const mk = manual.kcal ? Number(manual.kcal) : undefined;
  const mp = manual.protein ? Number(manual.protein) : undefined;

  return (
    <div className="space-y-4 pb-8">
      <PageHeader title="Goals & weight" back="/food" />

      <section className="card space-y-3 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Goal</h2>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(GOALS) as Goal[]).map((k) => (
            <button key={k} onClick={() => up({ goal: k })} className={`rounded-full px-3 py-2 text-sm font-semibold ${p.goal === k ? 'bg-ember-500 text-night-950' : 'bg-night-800 text-zinc-300'}`}>
              {GOALS[k].label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(['male', 'female'] as const).map((s) => (
            <button key={s} onClick={() => up({ sex: s })} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${p.sex === s ? 'bg-night-600 ring-1 ring-ember-500' : 'bg-night-800 text-zinc-400'}`}>
              {s === 'male' ? 'Male' : 'Female'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {num('age', 'Age', 'y')}
          {num('heightCm', 'Height', 'cm')}
          {num('weightKg', 'Weight', 'kg')}
        </div>
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-400">Activity</p>
          {(Object.keys(ACTIVITY) as Activity[]).map((k) => (
            <button key={k} onClick={() => up({ activity: k })} className={`flex w-full justify-between rounded-xl px-3 py-2 text-left text-sm ${p.activity === k ? 'bg-night-600 ring-1 ring-ember-500' : 'bg-night-800 text-zinc-400'}`}>
              <span className="font-semibold">{ACTIVITY[k].label}</span>
              <span className="text-xs">{ACTIVITY[k].hint}</span>
            </button>
          ))}
        </div>
      </section>

      {valid && (
        <section className="card space-y-3 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Your targets (estimate)</h2>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-night-800 py-3">
              <div className="text-2xl font-extrabold tabular-nums">{mk ?? t.kcal}</div>
              <div className="text-xs text-zinc-500">kcal / day</div>
            </div>
            <div className="rounded-xl bg-night-800 py-3">
              <div className="text-2xl font-extrabold tabular-nums text-protein-400">{mp ?? t.protein} g</div>
              <div className="text-xs text-zinc-500">
                protein · range {t.proteinRange[0]}–{t.proteinRange[1]} g
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Resting burn ≈ {t.bmr} kcal (Mifflin–St Jeor), with activity ≈ {t.tdee} kcal
            {GOALS[p.goal].kcalDelta !== 0 && `, ${GOALS[p.goal].kcalDelta > 0 ? '+' : ''}${GOALS[p.goal].kcalDelta} kcal for your goal`}. Protein {GOALS[p.goal].proteinPerKg} g per kg. These are starting points — your weight trend tells you if they fit.
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer text-zinc-400">Set my own numbers</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input inputMode="numeric" placeholder={`${t.kcal} kcal`} value={manual.kcal ?? ''} onChange={(e) => setManual({ ...manual, kcal: e.target.value.replace(/\D/g, '') })} className="rounded-xl border border-night-600 bg-night-800 px-3 py-2" aria-label="Own calorie target" />
              <input inputMode="numeric" placeholder={`${t.protein} g protein`} value={manual.protein ?? ''} onChange={(e) => setManual({ ...manual, protein: e.target.value.replace(/\D/g, '') })} className="rounded-xl border border-night-600 bg-night-800 px-3 py-2" aria-label="Own protein target" />
            </div>
          </details>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Count "eat enough calories" for your pet
              <span className="block text-xs text-zinc-500">Useful when bulking — under-eating is the usual problem.</span>
            </span>
            <input
              type="checkbox"
              checked={goals?.countCalories ?? p.goal === 'build'}
              disabled={!goals}
              onChange={(e) => goals && setSetting<FoodGoals>('nutritionGoals', { ...goals, countCalories: e.target.checked })}
              className="h-5 w-5 accent-[var(--color-ember-500)]"
            />
          </label>
          <button
            onClick={async () => {
              await saveGoals(p, t, g.today, goals ?? null, { kcal: mk, protein: mp });
              setSaved(true);
            }}
            className="w-full rounded-2xl bg-ember-500 py-3.5 font-bold text-night-950"
          >
            {saved ? '✓ Saved' : goals ? 'Update targets' : 'Start tracking'}
          </button>
          {!goals && <p className="text-xs text-zinc-500">From today on, hitting protein and logging 2+ meals count toward your pet's day score.</p>}
        </section>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Weight</h2>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const kg = Number(weightDraft.replace(',', '.'));
            if (kg > 20 && kg < 300) {
              await saveWeight(g.today, kg);
              setWeightDraft('');
              if (profile) setSetting<Profile>('profile', { ...profile, weightKg: kg });
            }
          }}
        >
          <input inputMode="decimal" value={weightDraft} onChange={(e) => setWeightDraft(e.target.value)} placeholder={latest ? `${latest.kg} kg` : 'Today’s weight in kg'} className="min-w-0 flex-1 rounded-xl border border-night-600 bg-night-800 px-3 py-2.5" aria-label="Weight in kg" />
          <button className="rounded-xl bg-night-700 px-4 font-semibold">Log</button>
        </form>
        <p className="text-xs text-zinc-500">Weigh in the morning, before breakfast. Daily numbers jump around — the 7-day average is what counts.</p>
        {trend.length >= 2 && <WeightChart points={weights} trend={trend} />}
        {advice && (
          <p className={`rounded-xl px-3 py-2 text-sm ${advice.kcalAdjust === 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-gold-400/10 text-gold-400'}`}>{advice.message}</p>
        )}
        {!advice && weights.length > 0 && <p className="text-xs text-zinc-500">After two weeks of weigh-ins you'll get a suggestion whether to eat a bit more or less.</p>}
      </section>
    </div>
  );
}

function WeightChart({ points, trend }: { points: { day: string; kg: number }[]; trend: { day: string; kg: number }[] }) {
  const last = points.slice(-60);
  const tr = trend.slice(-60);
  const all = [...last.map((p) => p.kg), ...tr.map((p) => p.kg)];
  const min = Math.min(...all) - 0.5;
  const max = Math.max(...all) + 0.5;
  const W = 320;
  const H = 120;
  const x = (i: number) => (last.length === 1 ? W / 2 : (i / (last.length - 1)) * W);
  const y = (kg: number) => H - ((kg - min) / (max - min)) * H;
  const path = tr.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`-6 -6 ${W + 12} ${H + 24}`} className="w-full" role="img" aria-label="Weight trend">
      {last.map((p, i) => (
        <circle key={p.day} cx={x(i)} cy={y(p.kg)} r="2.5" fill="var(--color-zinc-500)" />
      ))}
      <path d={path} fill="none" stroke="var(--color-ember-500)" strokeWidth="2.5" strokeLinejoin="round" />
      <text x="0" y={H + 16} fontSize="10" fill="var(--color-zinc-500)">
        {last[0].day.slice(5)} · {min.toFixed(1)}–{max.toFixed(1)} kg
      </text>
      <text x={W} y={H + 16} fontSize="10" textAnchor="end" fill="var(--color-zinc-400)">
        avg {tr[tr.length - 1].kg} kg
      </text>
    </svg>
  );
}
