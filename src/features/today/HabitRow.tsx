import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Habit } from '../../db/types';
import type { Day } from '../../core/date';
import { RULES } from '../../core/game/rules';
import { progressOf, scheduleLabel } from '../../core/habits/schedule';
import { addHabitValue, setHabitValue } from '../../state/actions';
import Ring from '../../components/Ring';
import Sparks from '../../components/Sparks';
import Sheet from '../../components/Sheet';
import { CATEGORIES } from '../../core/habits/templates';

interface Props {
  habit: Habit;
  day: Day;
  value: number;
  streak?: number;
  missedYesterday?: boolean;
  week?: { done: number; goal: number };
  bonus?: boolean;
  locked?: boolean;
  /** Progress came in from an auto-check today. */
  auto?: boolean;
}

export default function HabitRow({ habit, day, value, streak = 0, missedYesterday, week, bonus, locked, auto }: Props) {
  const progress = progressOf(habit, value);
  const done = progress >= 1;
  const [burst, setBurst] = useState(0);
  const [editing, setEditing] = useState(false);
  const prevDone = useRef(done);

  useEffect(() => {
    if (done && !prevDone.current) setBurst((b) => b + 1);
    prevDone.current = done;
  }, [done]);

  const set = (v: number) => !locked && setHabitValue(habit, day, Math.max(0, Math.round(v * 10) / 10));
  const add = (d: number) => !locked && addHabitValue(habit, day, d);
  const xp = RULES.xp[habit.difficulty];
  const cat = CATEGORIES[habit.category];

  const onMain = () => {
    if (habit.kind === 'check') set(done ? 0 : 1);
    else if (habit.kind === 'count') add(1);
    else set(done ? 0 : habit.target);
  };

  const sub =
    habit.kind === 'check'
      ? scheduleLabel(habit.schedule)
      : `${fmt(value)} / ${fmt(habit.target)} ${habit.unit ?? ''}`.trim();

  return (
    <div className={`card relative flex items-center gap-3 px-3.5 py-3 transition-colors ${done ? 'border-ember-500/40 bg-night-800' : ''}`}>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-label={`${habit.name} details`}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: `${cat.color}22` }}>
          {habit.icon}
        </span>
        <span className="min-w-0">
          <span className={`block truncate font-semibold ${done ? 'text-zinc-300' : ''}`}>{habit.name}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
            <span>{sub}</span>
            {week && <span className="text-zinc-500">· week {week.done + (done ? 1 : 0)}/{week.goal}</span>}
            {streak > 1 && <span className="text-ember-400">🔥 {streak}</span>}
            {bonus && <span className="text-xp-400">bonus</span>}
            {auto && <span className="rounded-full bg-sky-500/15 px-1.5 text-sky-300">🔗 auto</span>}
            {missedYesterday && !done && <span className="rounded-full bg-hp-500/20 px-1.5 text-hp-400">don't miss twice</span>}
          </span>
        </span>
      </button>

      {!locked && habit.kind === 'count' && value > 0 && (
        <button type="button" onClick={() => add(-1)} className="h-9 w-9 shrink-0 rounded-full bg-night-700 text-lg text-zinc-300" aria-label="One less">
          −
        </button>
      )}
      {!locked && habit.kind === 'duration' && !done && (
        <button type="button" onClick={() => add(5)} className="h-9 shrink-0 rounded-full bg-night-700 px-3 text-sm font-semibold text-zinc-200" aria-label="Add 5 minutes">
          +5
        </button>
      )}

      <button
        type="button"
        onClick={onMain}
        disabled={locked || (auto && habit.kind === 'check' && done)}
        className="relative shrink-0 disabled:opacity-50"
        aria-label={done ? `Undo ${habit.name}` : `Complete ${habit.name}`}
        aria-pressed={done}
      >
        <Ring value={progress} size={46} stroke={5} color={done ? 'var(--color-ember-500)' : 'var(--color-ember-400)'}>
          <span key={burst} className={`grid h-8 w-8 place-items-center rounded-full text-base font-bold ${done ? 'bg-ember-500 text-night-950 animate-pop' : 'text-zinc-400'}`}>
            {done ? '✓' : habit.kind === 'count' ? '+' : ''}
          </span>
        </Ring>
        {burst > 0 && <Sparks key={`s${burst}`} />}
      </button>

      {burst > 0 && done && (
        <span key={`f${burst}`} className="pointer-events-none absolute right-6 top-0 animate-float-up whitespace-nowrap text-sm font-bold text-gold-400">
          +{xp} XP · +{Math.round(xp * RULES.coinRatio)} 🪙
        </span>
      )}

      <ValueSheet open={editing} onClose={() => setEditing(false)} habit={habit} value={value} onSet={set} locked={locked} />
    </div>
  );
}

function ValueSheet({ open, onClose, habit, value, onSet, locked }: { open: boolean; onClose: () => void; habit: Habit; value: number; onSet: (v: number) => void; locked?: boolean }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    if (open) setDraft(String(value));
  }, [open, value]);
  return (
    <Sheet open={open} onClose={onClose} title={`${habit.icon} ${habit.name}`}>
      {habit.kind !== 'check' && !locked && (
        <form
          className="mb-4 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSet(Number(draft.replace(',', '.')) || 0);
            onClose();
          }}
        >
          <input
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-28 rounded-xl border border-night-600 bg-night-800 px-3 py-2"
            aria-label={`Value in ${habit.unit ?? 'units'}`}
          />
          <span className="text-zinc-400">/ {habit.target} {habit.unit}</span>
          <button className="ml-auto rounded-xl bg-ember-500 px-4 py-2 font-semibold text-night-950">Save</button>
        </form>
      )}
      {locked && <p className="mb-4 text-sm text-zinc-400">Days older than yesterday are locked — the pet already lived through them.</p>}
      <Link to={`/habits/${habit.id}`} className="block rounded-xl bg-night-800 px-4 py-3 text-center font-semibold" onClick={onClose}>
        Stats & settings →
      </Link>
    </Sheet>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
