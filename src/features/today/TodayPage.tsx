import { useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, parseDay } from '../../core/date';
import { dueInfo, valueOn } from '../../core/habits/schedule';
import { habitStats } from '../../core/habits/stats';
import { itemsForDay, dayScore } from '../../core/game/items';
import { useGame } from '../../state/game';
import Ring from '../../components/Ring';
import HabitRow from './HabitRow';
import PetCard from './PetCard';
import { RecapTeaser } from '../recap/RecapPage';

export default function TodayPage() {
  const g = useGame();
  const [offset, setOffset] = useState(0); // 0 = today, -1 = yesterday
  const [showOff, setShowOff] = useState(false);
  if (!g?.game || !g.pet) return null;
  const { game, pet, today, habits, logs } = g;
  const day = addDays(today, offset);
  const items = itemsForDay(day, g.itemCtx);
  const score = dayScore(items);
  const due = items.filter((i) => i.state === 'due');
  const doneDue = due.filter((i) => i.progress >= 1).length;
  const dayXp = items.filter((i) => i.state !== 'open' && i.progress >= 1).reduce((a, i) => a + i.xp, 0);

  const rows = habits.map((h) => ({ h, info: dueInfo(h, day, logs), value: valueOn(logs, h.id, day) }));
  const dueRows = rows.filter((r) => r.info.state === 'due' || r.info.state === 'bonus');
  const openRows = rows.filter((r) => r.info.state === 'open');
  const offRows = rows.filter((r) => r.info.state === 'off');
  const nutritionItems = items.filter((i) => i.kind === 'nutrition');

  const dateLabel = parseDay(today).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{dateLabel}</p>
          <h1 className="truncate text-xl font-extrabold tracking-tight">{greeting(new Date(g.now).getHours())}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-bold">
          <span className="rounded-full bg-night-800 px-2.5 py-1" title="Day streak">
            🔥 {game.displayStreak}
          </span>
          <span className="rounded-full bg-night-800 px-2.5 py-1" title="Streak freezes">
            ❄️ {game.freezes}
          </span>
          <Link to="/pet/shop" className="rounded-full bg-night-800 px-2.5 py-1 text-gold-400" title="Coins — open the shop">
            🪙 {game.coins}
          </Link>
        </div>
      </header>

      <PetCard game={game} pet={pet} now={g.now} worn={g.worn} />

      <RecapTeaser today={today} startDay={pet.startDay} />

      <section className="flex items-center gap-4 card px-4 py-3">
        <Ring value={score ?? 1} size={58} stroke={6}>
          <span className="text-sm font-extrabold tabular-nums">{score === null ? '—' : `${Math.round(score * 100)}%`}</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="whitespace-nowrap font-semibold">{due.length === 0 ? 'Nothing due' : `${doneDue}/${due.length} done`}</p>
          <p className="whitespace-nowrap text-sm text-zinc-400">+{dayXp} XP</p>
        </div>
        <div className="flex rounded-full bg-night-800 p-1 text-xs font-semibold" role="tablist" aria-label="Choose day">
          {[
            [0, 'Today'],
            [-1, 'Yesterday'],
          ].map(([o, label]) => (
            <button
              key={o}
              role="tab"
              aria-selected={offset === o}
              onClick={() => setOffset(o as number)}
              className={`rounded-full px-3 py-1.5 ${offset === o ? 'bg-ember-500 text-night-950' : 'text-zinc-400'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {habits.length === 0 ? (
        <Link to="/habits/new" className="card block p-6 text-center">
          <p className="text-3xl">🌱</p>
          <p className="mt-2 font-semibold">Add your first habit</p>
          <p className="text-sm text-zinc-400">Your pet grows from everything you do regularly.</p>
        </Link>
      ) : (
        <section className="space-y-2.5">
          {dueRows.map(({ h, info, value }) => {
            const st = habitStats(h, logs, day);
            return (
              <HabitRow
                key={`${h.id}:${day}`}
                habit={h}
                day={day}
                value={value}
                streak={st.streak}
                missedYesterday={offset === 0 && st.missedYesterday}
                week={info.week}
                bonus={info.state === 'bonus'}
                auto={g.autoSet.has(`${h.id}:${day}`)}
              />
            );
          })}
          {dueRows.length === 0 && <p className="px-1 text-sm text-zinc-400">No habits scheduled {offset === 0 ? 'today' : 'yesterday'}.</p>}
        </section>
      )}

      {nutritionItems.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Nutrition</h3>
          {nutritionItems.map((it) => (
            <Link key={it.key} to="/food" className="card flex items-center gap-3 px-3.5 py-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-protein-400/15 text-2xl">{it.icon}</span>
              <span className="flex-1 font-semibold">{it.label}</span>
              <Ring value={it.progress} size={40} stroke={5} color="var(--color-protein-400)">
                <span className="text-[10px] font-bold">{it.progress >= 1 ? '✓' : `${Math.round(it.progress * 100)}`}</span>
              </Ring>
            </Link>
          ))}
        </section>
      )}

      {openRows.length > 0 && (
        <section className="space-y-2.5">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Still open this week</h3>
          {openRows.map(({ h, info, value }) => (
            <HabitRow key={`${h.id}:${day}`} habit={h} day={day} value={value} week={info.week} auto={g.autoSet.has(`${h.id}:${day}`)} />
          ))}
        </section>
      )}

      {offRows.length > 0 && (
        <section className="space-y-2.5">
          <button onClick={() => setShowOff((s) => !s)} className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {showOff ? '▾' : '▸'} Not scheduled ({offRows.length}) — bonus XP
          </button>
          {showOff && offRows.map(({ h, value }) => <HabitRow key={`${h.id}:${day}`} habit={h} day={day} value={value} bonus auto={g.autoSet.has(`${h.id}:${day}`)} />)}
        </section>
      )}
    </div>
  );
}

function greeting(hour: number): string {
  if (hour < 4 || hour >= 22) return 'Late night';
  if (hour < 11) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
