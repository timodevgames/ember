import { Link } from 'react-router-dom';
import type { GameState } from '../../core/game/engine';
import { moodLine, petMood, stageProgress } from '../../core/game/pet';
import { RULES } from '../../core/game/rules';
import type { PetSettings } from '../../db/settings';
import Bar from '../../components/Bar';
import PetView from '../pet/PetView';
import { sceneBackground, STARRY } from '../../core/game/cosmetics';

export default function PetCard({ game, pet, now, worn }: { game: GameState; pet: PetSettings; now: number; worn: { hat?: string; bg?: string } }) {
  const hour = new Date(now).getHours();
  const mood = petMood(game, hour);
  const stage = RULES.stages[game.stage];
  const next = RULES.stages[game.stage + 1];
  const sp = stageProgress(game.bondXp, game.stage);
  const night = hour >= 21 || hour < 6;

  return (
    <section className="card overflow-hidden">
      <Link
        to="/pet"
        className="relative block"
        style={{ background: sceneBackground(worn.bg, night, game.away) }}
        aria-label={`${pet.name} — open pet page`}
      >
        {((night && !worn.bg) || STARRY.has(worn.bg ?? '')) && !game.away && (
          <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
            {[
              [12, 18],
              [78, 12],
              [88, 34],
              [24, 40],
              [62, 22],
            ].map(([x, y], i) => (
              <span key={i} className="absolute h-1 w-1 rounded-full bg-white/70" style={{ left: `${x}%`, top: `${y}%` }} />
            ))}
          </div>
        )}
        <div className="flex justify-center pt-2">
          <PetView stage={game.stage} mood={mood} color={pet.color} eggProgress={Math.min(1, game.bondXp / RULES.stages[1].xp)} size={176} hat={worn.hat} />
        </div>
      </Link>

      <div className="space-y-3 px-4 pb-4 pt-1">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="truncate text-xl font-extrabold">{pet.name}</h2>
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-400">{game.away ? 'In the forest' : stage.name}</span>
        </div>

        {!game.away && (
          <div className="grid grid-cols-[3.2rem_1fr_auto] items-center gap-x-2 gap-y-1.5 text-xs">
            <span className="font-semibold text-hp-400">HP</span>
            <Bar value={game.hp} max={100} color={game.hp < 30 ? 'var(--color-hp-500)' : 'var(--color-hp-400)'} label="Health" />
            <span className="w-14 text-right tabular-nums text-zinc-300">{game.hp}/100</span>
            <span className="font-semibold text-xp-400">Bond</span>
            <Bar value={sp.into} max={sp.span || 1} color="var(--color-xp-400)" label="Bond" />
            <span className="w-14 text-right tabular-nums text-zinc-300">{next ? `${sp.into}/${sp.span}` : 'MAX'}</span>
          </div>
        )}

        <p className="text-sm text-zinc-300">{moodLine(mood, pet.name, game)}</p>
        <Projection game={game} name={pet.name} />
        {next && !game.away && <p className="text-xs text-zinc-500">Next: {next.name} at {next.xp} bond XP</p>}
      </div>
    </section>
  );
}

function Projection({ game, name }: { game: GameState; name: string }) {
  const t = game.today;
  const base = 'rounded-xl px-3 py-2 text-sm';
  if (game.away) {
    return (
      <div className={`${base} bg-emerald-500/10 text-emerald-300`}>
        🌲 Rescue quest: <b>{game.rescueProgress}/{RULES.rescue.days}</b> strong days (≥{RULES.rescue.minScore * 100}%).
        {t.score !== null && t.score >= RULES.rescue.minScore ? ' Today counts! ✓' : ' Finish today strong to make progress.'}
      </div>
    );
  }
  if (t.score === null) return <div className={`${base} bg-night-800 text-zinc-400`}>😌 Rest day — nothing is due.</div>;
  if (t.wouldUseFreeze)
    return <div className={`${base} bg-sky-500/10 text-sky-300`}>❄️ A streak freeze would protect today — but don't count on it.</div>;
  if (t.projectedHpChange < 0)
    return (
      <div className={`${base} bg-hp-500/10 text-hp-400`}>
        ⚠️ {name} loses {-t.projectedHpChange} HP tonight. Reach {Math.round((t.safeAt ?? 0.5) * 100)}% to stay safe.
      </div>
    );
  if (t.projectedHpChange > 0) return <div className={`${base} bg-emerald-500/10 text-emerald-300`}>💚 On track: +{t.projectedHpChange} HP tonight.</div>;
  const goodBand = RULES.hp.bands[0];
  if (game.hp >= RULES.hp.max) return <div className={`${base} bg-emerald-500/10 text-emerald-300`}>💚 Safe — HP is full.</div>;
  return <div className={`${base} bg-night-800 text-zinc-300`}>Safe. Reach {goodBand.min * 100}% to heal +{goodBand.delta} HP.</div>;
}
