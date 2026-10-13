import { Link } from 'react-router-dom';
import { useGame } from '../../state/game';
import { habitStats, strengthLabel } from '../../core/habits/stats';
import { scheduleLabel } from '../../core/habits/schedule';
import { CATEGORIES } from '../../core/habits/templates';
import { saveHabit } from '../../state/actions';
import PageHeader from '../../components/PageHeader';
import Bar from '../../components/Bar';
import type { Habit } from '../../db/types';

export default function HabitsPage() {
  const g = useGame();
  if (!g) return null;
  const active = g.habits.filter((h) => !h.archivedDay || h.archivedDay > g.today);
  const archived = g.habits.filter((h) => h.archivedDay && h.archivedDay <= g.today);

  const move = async (h: Habit, dir: -1 | 1) => {
    const i = active.indexOf(h);
    const other = active[i + dir];
    if (!other) return;
    await saveHabit({ ...other, order: h.order });
    await saveHabit({ ...h, order: other.order });
  };

  return (
    <div>
      <PageHeader
        title="Habits"
        right={
          <Link to="/habits/new" className="rounded-full bg-ember-500 px-4 py-2 text-sm font-bold text-night-950">
            + New
          </Link>
        }
      />
      <div className="space-y-2.5">
        {active.map((h, i) => {
          const st = habitStats(h, g.logs, g.today);
          return (
            <div key={h.id} className="card flex items-center gap-3 px-3.5 py-3">
              <Link to={`/habits/${h.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: `${CATEGORIES[h.category].color}22` }}>
                  {h.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{h.name}</span>
                  <span className="block text-xs text-zinc-400">
                    {scheduleLabel(h.schedule)} · {strengthLabel(st.strength)} {Math.round(st.strength * 100)}%
                  </span>
                  <Bar value={st.strength} max={1} height="h-1.5" className="mt-1.5" color={CATEGORIES[h.category].color} label="Habit strength" />
                </span>
              </Link>
              <div className="flex flex-col">
                <button onClick={() => move(h, -1)} disabled={i === 0} className="px-2 text-zinc-500 disabled:opacity-20" aria-label={`Move ${h.name} up`}>
                  ▲
                </button>
                <button onClick={() => move(h, 1)} disabled={i === active.length - 1} className="px-2 text-zinc-500 disabled:opacity-20" aria-label={`Move ${h.name} down`}>
                  ▼
                </button>
              </div>
            </div>
          );
        })}
        {active.length === 0 && (
          <Link to="/habits/new" className="card block p-6 text-center text-zinc-300">
            No habits yet — add one 🌱
          </Link>
        )}
      </div>

      <p className="mt-4 px-1 text-xs text-zinc-500">
        Strength grows with consistency. Around 60 days of doing a habit regularly it usually turns automatic — that's when it shows 90%.
      </p>

      {archived.length > 0 && (
        <section className="mt-6 space-y-2">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Archived</h3>
          {archived.map((h) => (
            <Link key={h.id} to={`/habits/${h.id}`} className="card flex items-center gap-3 px-3.5 py-2.5 opacity-60">
              <span className="text-xl">{h.icon}</span>
              <span className="truncate">{h.name}</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
