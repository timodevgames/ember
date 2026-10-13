import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addDays, type Day } from '../../core/date';
import type { AutoSource } from '../../db/types';
import type { GdStat, MusicCoachStat, ValorantStat } from '../../core/integrations/types';

/** Extra stats for auto-checked habits: Valorant rank, GD progress, Music Coach minutes. */
export default function IntegrationCard({ source, today }: { source: AutoSource; today: Day }) {
  const rows = useLiveQuery(async () => {
    const all = await db.integrationStats.where('source').equals(source).toArray();
    return all.filter((r) => !r.deleted && r.id.startsWith('stat:')).sort((a, b) => a.day.localeCompare(b.day));
  }, [source]);
  if (!rows || rows.length === 0) return null;

  if (source === 'valorant') {
    const latestRank = [...rows].reverse().find((r) => (r.data as unknown as ValorantStat).tier);
    const rank = latestRank?.data as unknown as ValorantStat | undefined;
    const week = rows.filter((r) => r.day > addDays(today, -7));
    const matches = week.reduce((a, r) => a + ((r.data as unknown as ValorantStat).matches ?? 0), 0);
    const minutes = week.reduce((a, r) => a + ((r.data as unknown as ValorantStat).minutes ?? 0), 0);
    return (
      <section className="card grid grid-cols-3 gap-2 p-4 text-center">
        <Stat label="Rank" value={rank?.tier ?? '—'} />
        <Stat label="RR" value={rank?.rr !== undefined ? `${rank.rr}${rank.lastChange ? ` (${rank.lastChange > 0 ? '+' : ''}${rank.lastChange})` : ''}` : '—'} />
        <Stat label="Last 7 days" value={`${matches} · ${Math.round(minutes / 60)} h`} />
      </section>
    );
  }

  if (source === 'geometryDash') {
    const last = rows[rows.length - 1].data as unknown as GdStat;
    const base = (rows.find((r) => r.day >= addDays(today, -30)) ?? rows[0]).data as unknown as GdStat;
    const keys: [keyof GdStat, string][] = [
      ['stars', '⭐ Stars'],
      ['moons', '🌙 Moons'],
      ['diamonds', '💎 Diamonds'],
      ['demons', '😈 Demons'],
      ['levels', '🏁 Levels'],
      ['userCoins', '🪙 User coins'],
    ];
    return (
      <section className="card p-4">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Geometry Dash profile</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          {keys.map(([k, label]) => {
            const d = last[k] - (base[k] ?? 0);
            return <Stat key={k} label={label} value={`${last[k]}`} sub={d > 0 ? `+${d} in 30 d` : undefined} />;
          })}
        </div>
      </section>
    );
  }

  // Music Coach: minutes per day for the last 14 days
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const byDay = new Map(rows.map((r) => [r.day, (r.data as unknown as MusicCoachStat).minutes]));
  const max = Math.max(15, ...days.map((d) => byDay.get(d) ?? 0));
  return (
    <section className="card p-4">
      <h3 className="mb-2 text-sm font-semibold text-zinc-300">Music Coach minutes, last 14 days</h3>
      <div className="flex h-20 items-end gap-1">
        {days.map((d) => (
          <div key={d} className="flex h-full flex-1 flex-col justify-end" title={`${d}: ${byDay.get(d) ?? 0} min`}>
            <div className="rounded-t bg-xp-400" style={{ height: `${((byDay.get(d) ?? 0) / max) * 100}%` }} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-night-800 px-1 py-2">
      <div className="truncate text-sm font-bold">{value}</div>
      <div className="text-[10px] text-zinc-500">{label}</div>
      {sub && <div className="text-[10px] text-protein-400">{sub}</div>}
    </div>
  );
}
