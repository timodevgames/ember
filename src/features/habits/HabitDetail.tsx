import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../../state/game';
import { habitStats, strengthLabel } from '../../core/habits/stats';
import { dueInfo, progressOf, scheduleLabel, valueOn } from '../../core/habits/schedule';
import { CATEGORIES, AUTO_SOURCES } from '../../core/habits/templates';
import { RULES } from '../../core/game/rules';
import { deleteHabit, saveHabit } from '../../state/actions';
import PageHeader from '../../components/PageHeader';
import Heatmap from '../../components/Heatmap';
import Ring from '../../components/Ring';
import Sheet from '../../components/Sheet';
import IntegrationCard from './IntegrationCard';

export default function HabitDetail() {
  const { id } = useParams();
  const g = useGame();
  const nav = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!g) return null;
  const h = g.habits.find((x) => x.id === id);
  if (!h) return <PageHeader title="Habit not found" back="/habits" />;
  const st = habitStats(h, g.logs, g.today);
  const cat = CATEGORIES[h.category];
  const archived = !!h.archivedDay && h.archivedDay <= g.today;
  const hex = cat.color.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title={
          <span>
            {h.icon} {h.name}
          </span>
        }
        back="/habits"
        right={
          <Link to={`/habits/${h.id}/edit`} className="rounded-full bg-night-800 px-4 py-2 text-sm font-semibold">
            Edit
          </Link>
        }
      />

      <section className="card flex items-center gap-4 p-4">
        <Ring value={st.strength} size={84} stroke={8} color={cat.color}>
          <span>
            <span className="block text-lg font-extrabold">{Math.round(st.strength * 100)}%</span>
            <span className="block text-[10px] text-zinc-400">strength</span>
          </span>
        </Ring>
        <div className="grid flex-1 grid-cols-2 gap-y-2 text-sm">
          <Stat label="Current streak" value={`🔥 ${st.streak}`} />
          <Stat label="Best streak" value={`🏆 ${st.bestStreak}`} />
          <Stat label="Completions" value={`✓ ${st.completions}`} />
          <Stat label="Stage" value={strengthLabel(st.strength)} />
        </div>
      </section>

      {h.autoSource && <IntegrationCard source={h.autoSource} today={g.today} />}

      <section className="card p-4">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Last months</h3>
        <Heatmap
          today={g.today}
          color={rgb}
          cell={(d) => {
            if (d < h.createdDay) return { value: null };
            const info = dueInfo(h, d, g.logs);
            const p = progressOf(h, valueOn(g.logs, h.id, d));
            if (info.state === 'off' || info.state === 'inactive' || info.state === 'open') return { value: p > 0 ? p : null };
            return { value: p };
          }}
        />
      </section>

      <section className="card divide-y divide-night-700 text-sm">
        <Row label="Schedule" value={scheduleLabel(h.schedule)} />
        <Row label="Goal" value={h.kind === 'check' ? 'Done / not done' : `${h.target} ${h.unit ?? ''}`} />
        <Row label="Difficulty" value={`${h.difficulty} · ${RULES.xp[h.difficulty]} XP`} />
        <Row label="Category" value={`${cat.icon} ${cat.label}`} />
        <Row label="Auto-check" value={h.autoSource ? `${AUTO_SOURCES[h.autoSource].icon} ${AUTO_SOURCES[h.autoSource].label}` : 'Manual'} />
        <Row label="Tracking since" value={h.createdDay} />
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => saveHabit({ ...h, archivedDay: archived ? undefined : g.today })}
          className="rounded-2xl bg-night-800 py-3 font-semibold"
        >
          {archived ? 'Unarchive' : 'Archive'}
        </button>
        <button onClick={() => setConfirmDelete(true)} className="rounded-2xl bg-hp-500/15 py-3 font-semibold text-hp-400">
          Delete
        </button>
      </div>
      <p className="px-1 text-xs text-zinc-500">Archive stops the habit from today on but keeps its history. Delete erases it — including from your pet's past days.</p>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this habit?" center>
        <p className="mb-4 text-sm text-zinc-300">
          Its whole history disappears and your pet's past days get re-scored without it. Archiving is usually the better choice.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setConfirmDelete(false)} className="rounded-xl bg-night-800 py-3 font-semibold">
            Cancel
          </button>
          <button
            onClick={async () => {
              await deleteHabit(h.id);
              nav('/habits', { replace: true });
            }}
            className="rounded-xl bg-hp-500 py-3 font-semibold text-white"
          >
            Delete
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 px-4 py-2.5">
      <span className="text-zinc-400">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
