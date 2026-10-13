import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { alive } from '../../db/repo';
import { addDays, parseDay, weekStart, type Day } from '../../core/date';
import { RULES } from '../../core/game/rules';
import { recapVerdict, weekRecap } from '../../core/game/recap';
import { useGame } from '../../state/game';
import PageHeader from '../../components/PageHeader';
import Bar from '../../components/Bar';
import PetView from '../pet/PetView';

const fmt = (d: Day) => parseDay(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function RecapPage() {
  const g = useGame();
  const [params, setParams] = useSearchParams();
  const extra = useLiveQuery(async () => ({
    weights: alive(await db.weights.toArray()),
    stats: alive(await db.integrationStats.toArray()),
  }));
  if (!g?.game || !g.pet || !extra) return null;

  const thisWeek = weekStart(g.today);
  const start: Day = params.get('week') ?? addDays(thisWeek, -7);
  const r = weekRecap({ weekStart: start, today: g.today, game: g.game, habits: g.habits, logs: g.logs, nutritionFor: g.nutritionFor, goals: g.nutritionGoals, weights: extra.weights, stats: extra.stats });
  const canPrev = addDays(start, 6) >= g.pet.startDay;
  const canNext = start < thisWeek;
  const go = (d: Day) => setParams({ week: d }, { replace: true });
  const running = start === thisWeek;

  return (
    <div className="space-y-4 pb-8">
      <PageHeader title="Week in review" back="/pet" />
      <div className="flex items-center justify-between">
        <button onClick={() => go(addDays(start, -7))} disabled={!canPrev} className="grid h-9 w-9 place-items-center rounded-full bg-night-800 text-lg disabled:opacity-30" aria-label="Previous week">
          ‹
        </button>
        <span className="font-semibold">
          {fmt(r.weekStart)} – {fmt(r.weekEnd)}
          {running && <span className="ml-2 text-xs text-zinc-500">so far</span>}
        </span>
        <button onClick={() => go(addDays(start, 7))} disabled={!canNext} className="grid h-9 w-9 place-items-center rounded-full bg-night-800 text-lg disabled:opacity-30" aria-label="Next week">
          ›
        </button>
      </div>

      {r.days === 0 ? (
        <p className="card p-5 text-center text-zinc-400">No finished days in this week yet.</p>
      ) : (
        <>
          <section className="card flex items-center gap-4 p-4">
            <PetView stage={g.game.stage} mood={r.avgScore !== null && r.avgScore >= 0.75 ? 'happy' : r.avgScore !== null && r.avgScore < 0.5 ? 'sad' : 'content'} color={g.pet.color} size={96} hat={g.worn.hat} />
            <div className="min-w-0 flex-1">
              <p className="text-3xl font-extrabold tabular-nums">{r.avgScore === null ? '—' : `${Math.round(r.avgScore * 100)}%`}</p>
              <p className="text-xs text-zinc-500">average day score</p>
              <p className="mt-1 text-sm text-zinc-300">{recapVerdict(r.avgScore, g.pet.name)}</p>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2 text-center">
            <Tile value={`⭐ ${r.perfectDays}`} label="perfect days" />
            <Tile value={`+${r.xp}`} label="bond XP" />
            <Tile value={`🪙 ${r.coins}`} label="coins" />
            <Tile value={`${r.hpEnd - r.hpStart >= 0 ? '+' : ''}${r.hpEnd - r.hpStart}`} label={`HP (now ${r.hpEnd})`} />
            <Tile value={`❄️ ${r.freezesUsed}`} label="freezes used" />
            <Tile value={r.finds.length ? r.finds.join('') : '—'} label="treasures" />
          </section>

          {(r.evolved.length > 0 || r.ranAway || r.rescued) && (
            <section className="card space-y-1 p-4 text-sm">
              {r.evolved.map((s) => (
                <p key={s}>✨ Evolved into a <b>{RULES.stages[s].name}</b></p>
              ))}
              {r.ranAway && <p className="text-hp-400">🌲 {g.pet.name} ran away this week.</p>}
              {r.rescued && <p className="text-emerald-300">🏡 You brought {g.pet.name} home.</p>}
            </section>
          )}

          {r.habits.length > 0 && (
            <section className="card space-y-2.5 p-4">
              <h3 className="text-sm font-semibold text-zinc-300">Habits</h3>
              {r.habits.map((h, i) => (
                <div key={h.id}>
                  <div className="flex justify-between text-sm">
                    <span className="truncate">
                      {h.icon} {h.name}
                      {i === 0 && h.rate >= 0.8 && <span className="ml-1 text-xs text-gold-400">MVP</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-zinc-400">
                      {h.done}/{h.due}
                    </span>
                  </div>
                  <Bar value={h.rate} max={1} height="h-1.5" color={h.rate >= 0.8 ? 'var(--color-protein-400)' : h.rate >= 0.5 ? 'var(--color-ember-400)' : 'var(--color-hp-400)'} label={h.name} />
                </div>
              ))}
              {r.habits.length > 1 && r.habits[r.habits.length - 1].rate < 0.5 && (
                <p className="pt-1 text-xs text-zinc-500">
                  Focus for next week: <b className="text-zinc-300">{r.habits[r.habits.length - 1].name}</b>. Doing it right after something you already do every day makes it stick faster.
                </p>
              )}
            </section>
          )}

          {(r.nutrition || r.weight) && (
            <section className="card grid grid-cols-2 gap-2 p-4 text-center">
              {r.nutrition && (
                <>
                  <Tile value={`${r.nutrition.proteinDays}/${r.nutrition.trackedDays}`} label="protein goal hit" />
                  <Tile value={`${r.nutrition.avgProtein} g`} label="avg protein" />
                  <Tile value={`${r.nutrition.avgKcal}`} label="avg kcal" />
                </>
              )}
              {r.weight && <Tile value={`${r.weight.end - r.weight.start >= 0 ? '+' : ''}${(r.weight.end - r.weight.start).toFixed(1)} kg`} label={`weight (${r.weight.end} kg)`} />}
            </section>
          )}

          {(r.valorant || r.gd || r.musicMinutes) && (
            <section className="card space-y-1.5 p-4 text-sm">
              <h3 className="text-sm font-semibold text-zinc-300">Auto-tracked</h3>
              {r.musicMinutes !== null && <p>🎹 {r.musicMinutes} min in Music Coach</p>}
              {r.valorant && (
                <p>
                  🎯 {r.valorant.matches} Valorant matches · {r.valorant.hours} h
                  {r.valorant.rankEnd && r.valorant.rankStart !== r.valorant.rankEnd ? ` · ${r.valorant.rankStart} → ${r.valorant.rankEnd}` : r.valorant.rankEnd ? ` · ${r.valorant.rankEnd}` : ''}
                </p>
              )}
              {r.gd && Object.keys(r.gd).length > 0 && (
                <p>
                  🔺 Geometry Dash:{' '}
                  {Object.entries(r.gd)
                    .map(([k, v]) => `+${v} ${k}`)
                    .join(', ')}
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-night-800 px-1 py-2.5">
      <div className="truncate font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-zinc-500">{label}</div>
    </div>
  );
}

/** Small card for the Today page on Mondays/Tuesdays. */
export function RecapTeaser({ today, startDay }: { today: Day; startDay: Day }) {
  const wd = (parseDay(today).getDay() + 6) % 7;
  const lastWeek = addDays(weekStart(today), -7);
  if (wd > 1 || addDays(lastWeek, 6) < startDay) return null;
  return (
    <Link to={`/recap?week=${lastWeek}`} className="card flex items-center gap-3 px-4 py-3">
      <span className="text-2xl">📊</span>
      <span className="flex-1">
        <span className="block font-semibold">Your week in review</span>
        <span className="block text-xs text-zinc-400">How did last week go?</span>
      </span>
      <span className="text-zinc-500">›</span>
    </Link>
  );
}
