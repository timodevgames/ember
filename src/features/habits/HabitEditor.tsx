import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../db/db';
import type { AutoSource, Category, Difficulty, Habit, HabitKind, Schedule } from '../../db/types';
import { AUTO_SOURCES, CATEGORIES, TEMPLATES, type HabitTemplate } from '../../core/habits/templates';
import { WEEKDAY_SHORT } from '../../core/date';
import { RULES } from '../../core/game/rules';
import { saveHabit } from '../../state/actions';
import { useGame } from '../../state/game';
import PageHeader from '../../components/PageHeader';

type Form = {
  name: string;
  icon: string;
  category: Category;
  kind: HabitKind;
  target: number;
  unit: string;
  schedule: Schedule;
  difficulty: Difficulty;
  autoSource?: AutoSource;
};

const EMPTY: Form = { name: '', icon: '⭐', category: 'other', kind: 'check', target: 1, unit: '', schedule: { type: 'daily' }, difficulty: 'medium' };
const ICONS = ['🎹', '🎸', '🎯', '🔺', '🎮', '💧', '💪', '🏃', '🧘', '📚', '📝', '🛏️', '🥗', '🦷', '🧹', '💊', '🧠', '✍️', '🌅', '📵'];

function fromTemplate(t: HabitTemplate): Form {
  return { name: t.name, icon: t.icon, category: t.category, kind: t.kind, target: t.target, unit: t.unit ?? '', schedule: t.schedule, difficulty: t.difficulty, autoSource: t.autoSource };
}

export default function HabitEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const g = useGame();
  const [existing, setExisting] = useState<Habit | null>(null);
  const [form, setForm] = useState<Form | null>(id ? null : EMPTY);
  const [picking, setPicking] = useState(!id);

  useEffect(() => {
    if (!id) return;
    db.habits.get(id).then((h) => {
      if (!h) return;
      setExisting(h);
      setForm({ name: h.name, icon: h.icon, category: h.category, kind: h.kind, target: h.target, unit: h.unit ?? '', schedule: h.schedule, difficulty: h.difficulty, autoSource: h.autoSource });
    });
  }, [id]);

  if (!form || !g) return null;
  const up = (patch: Partial<Form>) => setForm({ ...form, ...patch });

  if (picking) {
    const have = new Set(g.habits.map((h) => h.name));
    return (
      <div>
        <PageHeader title="New habit" back="/habits" />
        <div className="space-y-2">
          {TEMPLATES.filter((t) => !have.has(t.name)).map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setForm(fromTemplate(t));
                setPicking(false);
              }}
              className="card flex w-full items-center gap-3 px-3.5 py-3 text-left"
            >
              <span className="text-2xl">{t.icon}</span>
              <span className="min-w-0">
                <span className="block font-semibold">{t.name}</span>
                <span className="block text-xs text-zinc-400">{t.blurb}</span>
              </span>
            </button>
          ))}
          <button onClick={() => setPicking(false)} className="w-full rounded-2xl border border-dashed border-night-600 px-4 py-3 font-semibold text-zinc-300">
            ✏️ Custom habit
          </button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (!form.name.trim()) return;
    const target = form.kind === 'check' ? 1 : Math.max(1, form.target);
    const h = await saveHabit({
      ...(existing ?? {}),
      id: existing?.id,
      name: form.name.trim(),
      icon: form.icon || '⭐',
      category: form.category,
      kind: form.kind,
      target,
      unit: form.kind === 'duration' ? 'min' : form.unit.trim() || undefined,
      schedule: form.schedule,
      difficulty: form.difficulty,
      autoSource: form.autoSource,
      order: existing?.order ?? -1,
      createdDay: existing?.createdDay ?? g.today,
    });
    nav(existing ? `/habits/${h.id}` : '/', { replace: true });
  };

  const s = form.schedule;
  return (
    <div className="pb-6">
      <PageHeader title={existing ? 'Edit habit' : 'New habit'} back={existing ? `/habits/${existing.id}` : '/habits'} />
      <div className="space-y-5">
        <Field label="Name">
          <div className="flex gap-2">
            <input value={form.icon} onChange={(e) => up({ icon: e.target.value })} className="w-14 rounded-xl border border-night-600 bg-night-800 px-2 py-2.5 text-center text-xl" aria-label="Icon" maxLength={4} />
            <input value={form.name} onChange={(e) => up({ name: e.target.value })} placeholder="e.g. Play piano" className="min-w-0 flex-1 rounded-xl border border-night-600 bg-night-800 px-3 py-2.5" autoFocus={!existing} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ICONS.map((i) => (
              <button key={i} onClick={() => up({ icon: i })} className={`grid h-9 w-9 place-items-center rounded-lg text-lg ${form.icon === i ? 'bg-ember-500/30 ring-1 ring-ember-500' : 'bg-night-800'}`}>
                {i}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Category">
          <Chips
            value={form.category}
            options={(Object.keys(CATEGORIES) as Category[]).map((c) => [c, `${CATEGORIES[c].icon} ${CATEGORIES[c].label}`])}
            onChange={(category) => up({ category })}
          />
        </Field>

        <Field label="Type">
          <Chips
            value={form.kind}
            options={[
              ['check', '✓ Done / not done'],
              ['count', '# Count'],
              ['duration', '⏱ Minutes'],
            ]}
            onChange={(kind) => up({ kind, target: kind === 'check' ? 1 : kind === 'duration' ? 15 : Math.max(2, form.target) })}
          />
          {form.kind !== 'check' && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-zinc-400">Goal</span>
              <input type="number" min={1} value={form.target} onChange={(e) => up({ target: Number(e.target.value) })} className="w-20 rounded-xl border border-night-600 bg-night-800 px-3 py-2" aria-label="Goal" />
              {form.kind === 'count' ? (
                <input value={form.unit} onChange={(e) => up({ unit: e.target.value })} placeholder="unit (glasses…)" className="min-w-0 flex-1 rounded-xl border border-night-600 bg-night-800 px-3 py-2" aria-label="Unit" />
              ) : (
                <span className="text-sm text-zinc-400">minutes</span>
              )}
            </div>
          )}
        </Field>

        <Field label="When">
          <Chips
            value={s.type}
            options={[
              ['daily', 'Every day'],
              ['weekdays', 'Specific days'],
              ['perWeek', 'X per week'],
            ]}
            onChange={(type) =>
              up({ schedule: type === 'daily' ? { type } : type === 'weekdays' ? { type, days: [0, 1, 2, 3, 4] } : { type, times: 3 } })
            }
          />
          {s.type === 'weekdays' && (
            <div className="mt-2 flex gap-1.5">
              {WEEKDAY_SHORT.map((d, i) => {
                const on = s.days.includes(i);
                return (
                  <button
                    key={d}
                    onClick={() => up({ schedule: { type: 'weekdays', days: on ? s.days.filter((x) => x !== i) : [...s.days, i].sort() } })}
                    className={`h-10 flex-1 rounded-xl text-xs font-semibold ${on ? 'bg-ember-500 text-night-950' : 'bg-night-800 text-zinc-400'}`}
                    aria-pressed={on}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}
          {s.type === 'perWeek' && (
            <div className="mt-2 flex items-center gap-3">
              <input type="range" min={1} max={6} value={s.times} onChange={(e) => up({ schedule: { type: 'perWeek', times: Number(e.target.value) } })} className="flex-1 accent-[var(--color-ember-500)]" aria-label="Times per week" />
              <span className="w-24 text-sm font-semibold">{s.times}× per week</span>
            </div>
          )}
        </Field>

        <Field label="Difficulty" hint="Harder habits weigh more in your day score and give more XP.">
          <Chips
            value={form.difficulty}
            options={(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => [d, `${d[0].toUpperCase()}${d.slice(1)} · ${RULES.xp[d]} XP`])}
            onChange={(difficulty) => up({ difficulty })}
          />
        </Field>

        <Field label="Auto-check" hint="Your Pixel server ticks it for you (Settings → Auto-checks, needs sync). You can always tick it by hand.">
          <Chips
            value={form.autoSource ?? 'none'}
            options={[['none', 'Manual only'], ...(Object.keys(AUTO_SOURCES) as AutoSource[]).map((k) => [k, `${AUTO_SOURCES[k].icon} ${AUTO_SOURCES[k].label}`] as [string, string])]}
            onChange={(v) => up({ autoSource: v === 'none' ? undefined : (v as AutoSource) })}
          />
        </Field>

        <button onClick={submit} disabled={!form.name.trim() || (s.type === 'weekdays' && s.days.length === 0)} className="w-full rounded-2xl bg-ember-500 py-3.5 font-bold text-night-950 disabled:opacity-40">
          {existing ? 'Save changes' : 'Add habit'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function Chips<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`rounded-full px-3 py-2 text-sm font-semibold ${value === v ? 'bg-ember-500 text-night-950' : 'bg-night-800 text-zinc-300'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
