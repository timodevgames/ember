import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useGame } from '../../state/game';
import { petMood, stageProgress } from '../../core/game/pet';
import { RULES } from '../../core/game/rules';
import { BADGES } from '../../core/game/badges';
import { db } from '../../db/db';
import { alive } from '../../db/repo';
import PageHeader from '../../components/PageHeader';
import Heatmap from '../../components/Heatmap';
import Bar from '../../components/Bar';
import PetView from './PetView';
import { sceneBackground } from '../../core/game/cosmetics';

export default function PetPage() {
  const g = useGame();
  const proteinDays = useLiveQuery(async () => {
    const goals = g?.nutritionGoals;
    if (!goals) return 0;
    const logs = alive(await db.foodLogs.toArray());
    const byDay = new Map<string, number>();
    for (const l of logs) byDay.set(l.day, (byDay.get(l.day) ?? 0) + l.nutrients.protein);
    return [...byDay.values()].filter((p) => p >= goals.protein * RULES.nutrition.proteinMin).length;
  }, [g?.nutritionGoals]);
  if (!g?.game || !g.pet) return null;
  const { game, pet } = g;
  const mood = petMood(game, new Date(g.now).getHours());
  const sp = stageProgress(game.bondXp, game.stage);
  const historyByDay = new Map(game.history.map((d) => [d.day, d]));
  const rewardsBought = g.purchases.filter((p) => p.itemId.startsWith('reward:')).length;
  const extra = { rewardsBought, proteinDays: proteinDays ?? 0 };

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title={pet.name}
        right={
          <Link to="/pet/shop" className="rounded-full bg-gold-400 px-4 py-2 text-sm font-bold text-night-950">
            🪙 {game.coins} · Shop
          </Link>
        }
      />

      <section className="card overflow-hidden">
        <div className="flex justify-center pt-3" style={{ background: sceneBackground(g.worn.bg, false, game.away) }}>
          <PetView stage={game.stage} mood={mood} color={pet.color} eggProgress={Math.min(1, game.bondXp / RULES.stages[1].xp)} size={230} hat={g.worn.hat} />
        </div>
        <div className="space-y-2 p-4">
          <div className="flex justify-between text-sm">
            <span className="font-bold">{game.away ? 'Lost in the forest' : RULES.stages[game.stage].name}</span>
            <span className="text-zinc-400">{game.bondXp} bond XP</span>
          </div>
          <Bar value={sp.ratio} max={1} color="var(--color-xp-400)" label="Evolution progress" />
        </div>
      </section>

      <Link to="/recap" className="card flex items-center gap-3 px-4 py-3">
        <span className="text-2xl">📊</span>
        <span className="flex-1 font-semibold">Week in review</span>
        <span className="text-zinc-500">›</span>
      </Link>

      <section className="grid grid-cols-3 gap-2 text-center">
        <Tile label="HP" value={`${game.hp}`} icon="❤️" />
        <Tile label="Streak" value={`${game.displayStreak}`} icon="🔥" />
        <Tile label="Best" value={`${game.bestStreak}`} icon="🏆" />
        <Tile label="Freezes" value={`${game.freezes}/${RULES.freeze.maxHeld}`} icon="❄️" />
        <Tile label="Perfect days" value={`${game.perfectDays}`} icon="⭐" />
        <Tile label="Rescues" value={`${game.rescues}`} icon="🌲" />
      </section>

      <section className="card p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-300">Evolution path</h3>
        <ol className="space-y-2">
          {RULES.stages.map((s, i) => (
            <li key={s.key} className={`flex items-center gap-3 text-sm ${i > game.stage ? 'text-zinc-500' : ''}`}>
              <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${i <= game.stage ? 'bg-xp-400 text-night-950' : 'bg-night-700'}`}>
                {i <= game.stage ? '✓' : i}
              </span>
              <span className="flex-1">{s.name}</span>
              <span className="tabular-nums text-xs">{s.xp} XP</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-zinc-500">
          The Five-Tail usually arrives after about two months of steady days — roughly how long it takes a habit to become automatic.
        </p>
      </section>

      <section className="card p-4">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Treasures found on perfect days</h3>
        <div className="grid grid-cols-5 gap-2 text-center">
          {RULES.finds
            .filter((f) => !f.coins)
            .map((f) => (
              <div key={f.id} className={`rounded-xl bg-night-800 py-2 ${game.inventory[f.id] ? '' : 'opacity-30 grayscale'}`} title={f.name}>
                <div className="text-2xl">{f.icon}</div>
                <div className="text-xs tabular-nums text-zinc-400">{game.inventory[f.id] ?? 0}</div>
              </div>
            ))}
        </div>
      </section>

      <section className="card p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-300">Badges</h3>
        <div className="grid grid-cols-3 gap-2">
          {BADGES.map((b) => {
            const earned = b.earned(game, extra);
            return (
              <div key={b.id} className={`rounded-xl px-2 py-3 text-center ${earned ? 'bg-night-700' : 'bg-night-800 opacity-45'}`} title={b.hint}>
                <div className={`text-3xl ${earned ? '' : 'grayscale'}`}>{b.icon}</div>
                <div className="mt-1 text-xs font-semibold leading-tight">{b.name}</div>
                {!earned && <div className="mt-0.5 text-[10px] leading-tight text-zinc-500">{b.hint}</div>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-4">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Day scores</h3>
        <Heatmap
          today={g.today}
          cell={(d) => {
            const r = historyByDay.get(d);
            if (!r) return { value: null };
            if (r.kind === 'vacation') return { value: null, vacation: true };
            return { value: r.score };
          }}
        />
      </section>
    </div>
  );
}

function Tile({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="card px-2 py-3">
      <div className="text-lg font-extrabold tabular-nums">
        {icon} {value}
      </div>
      <div className="text-[11px] text-zinc-500">{label}</div>
    </div>
  );
}
