import { useEffect, useState } from 'react';
import { useGame } from '../../state/game';
import { getMeta, setMeta } from '../../db/repo';
import { RULES } from '../../core/game/rules';
import type { GameEvent } from '../../core/game/engine';
import Sheet from '../../components/Sheet';
import Sparks from '../../components/Sparks';
import PetView from '../pet/PetView';

/**
 * Shows the big moments once: evolution, a treasure found on a perfect day,
 * running away, the rescue. Events come from the replayed history; a seen-list
 * in local meta makes sure each one pops up a single time per device.
 */
interface Shown {
  key: string;
  event: GameEvent;
}

const SHOW: GameEvent['type'][] = ['evolved', 'find', 'ranAway', 'rescued', 'freezeUsed', 'freezeEarned'];

export default function EventCenter() {
  const g = useGame();
  const [queue, setQueue] = useState<Shown[]>([]);

  useEffect(() => {
    if (!g?.game) return;
    const recent = g.game.history.slice(-3);
    const candidates: Shown[] = recent.flatMap((d) =>
      d.events.filter((e) => SHOW.includes(e.type)).map((e) => ({ key: `${d.day}:${e.type}:${'stage' in e ? e.stage : 'find' in e ? e.find.id : ''}`, event: e })),
    );
    if (candidates.length === 0) return;
    let cancelled = false;
    getMeta<string[]>('seenEvents', []).then((seen) => {
      if (cancelled) return;
      const fresh = candidates.filter((c) => !seen.includes(c.key));
      if (fresh.length) setQueue((q) => [...q, ...fresh.filter((f) => !q.some((x) => x.key === f.key))]);
    });
    return () => {
      cancelled = true;
    };
  }, [g?.game]);

  const cur = queue[0];
  const dismiss = async () => {
    if (!cur) return;
    const seen = await getMeta<string[]>('seenEvents', []);
    await setMeta('seenEvents', [...seen, cur.key].slice(-100));
    setQueue((q) => q.slice(1));
  };
  if (!cur || !g?.pet || !g.game) return null;
  const { pet, game } = g;
  const e = cur.event;

  let title = '';
  let text = '';
  let visual: React.ReactNode = null;
  switch (e.type) {
    case 'evolved':
      title = e.stage === 1 ? `${pet.name} hatched!` : `${pet.name} evolved!`;
      text = `It is now a ${RULES.stages[e.stage].name}. ${RULES.stages[e.stage + 1] ? `Next: ${RULES.stages[e.stage + 1].name} at ${RULES.stages[e.stage + 1].xp} bond XP.` : 'The final form. Legendary.'}`;
      visual = <PetView stage={e.stage} mood="ecstatic" color={pet.color} size={180} />;
      break;
    case 'find':
      title = 'Perfect day!';
      text = e.find.coins ? `${pet.name} dug up a coin pouch: +${e.find.coins} 🪙` : `${pet.name} found a ${e.find.name.toLowerCase()} for your collection.`;
      visual = <div className="py-4 text-7xl">{e.find.icon}</div>;
      break;
    case 'ranAway':
      title = `${pet.name} ran away…`;
      text = `Its HP hit 0 and it fled into the forest. Have ${RULES.rescue.days} strong days in a row (≥${RULES.rescue.minScore * 100}%) to bring it home.`;
      visual = <PetView stage={game.stage} mood="away" size={170} />;
      break;
    case 'rescued':
      title = `${pet.name} is back!`;
      text = `You found it in the forest. It lost one stage but it's home with ${RULES.rescue.returnHp} HP. Don't let it happen again.`;
      visual = <PetView stage={e.stage} mood="happy" color={pet.color} size={170} />;
      break;
    case 'freezeUsed':
      title = 'A streak freeze saved you';
      text = 'Yesterday was weak, so a freeze kicked in: no HP lost, streak kept.';
      visual = <div className="py-4 text-7xl">❄️</div>;
      break;
    case 'freezeEarned':
      title = 'Streak freeze earned';
      text = `A ${RULES.freeze.earnEvery}-day streak! You get a freeze that protects one bad day.`;
      visual = <div className="py-4 text-7xl">❄️</div>;
      break;
  }

  return (
    <Sheet open onClose={dismiss} center>
      <div className="relative flex flex-col items-center text-center">
        {e.type !== 'ranAway' && <Sparks count={18} spread={90} />}
        {visual}
        <h2 className="mt-1 text-2xl font-extrabold">{title}</h2>
        <p className="mt-2 text-zinc-300">{text}</p>
        <button onClick={dismiss} className="mt-5 w-full rounded-2xl bg-ember-500 py-3 font-bold text-night-950">
          {e.type === 'ranAway' ? "I'll get it back" : 'Yay'}
        </button>
      </div>
    </Sheet>
  );
}
