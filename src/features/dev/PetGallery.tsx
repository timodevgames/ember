import { RULES } from '../../core/game/rules';
import type { Mood } from '../../core/game/pet';
import PetView from '../pet/PetView';

/** Dev-only: every stage × mood on one page, to eyeball the drawings. */
const MOODS: Mood[] = ['ecstatic', 'happy', 'content', 'sad', 'sick', 'sleeping'];

export default function PetGallery() {
  return (
    <div className="space-y-4 pb-10">
      <h1 className="text-xl font-bold">Pet gallery</h1>
      <div className="flex flex-wrap gap-2">
        <PetView stage={0} mood="egg" eggProgress={0.1} size={100} />
        <PetView stage={0} mood="egg" eggProgress={0.9} size={100} />
        <PetView stage={3} mood="away" size={100} />
      </div>
      {RULES.stages.slice(1).map((s, i) => (
        <section key={s.key}>
          <h2 className="text-sm text-zinc-400">{s.name}</h2>
          <div className="grid grid-cols-3 gap-1">
            {MOODS.map((m) => (
              <div key={m} className="text-center text-[10px] text-zinc-500">
                <PetView stage={i + 1} mood={m} size={110} />
                {m}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
