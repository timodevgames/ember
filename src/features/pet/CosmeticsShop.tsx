import { useState } from 'react';
import type { PetSettings } from '../../db/types';
import { setSetting } from '../../db/settings';
import { COSMETICS, cosmeticItemId, ownedCosmetics, sceneBackground, type Cosmetic } from '../../core/game/cosmetics';
import { RULES } from '../../core/game/rules';
import { useGame } from '../../state/game';
import PetView from './PetView';

interface Props {
  /** Opens the shop's confirm dialog; `after` runs once the purchase is saved. */
  onBuy: (item: { itemId: string; name: string; cost: number; icon: string; after?: () => Promise<void> }) => void;
}

export default function CosmeticsShop({ onBuy }: Props) {
  const g = useGame();
  const [tab, setTab] = useState<'hat' | 'bg'>('hat');
  if (!g?.game || !g.pet) return null;
  const pet = g.pet;
  const owned = ownedCosmetics(g.purchases);
  const stage = Math.max(2, g.game.stage); // preview on a real fox, even while it's an egg
  const wear = (c: Cosmetic, on: boolean) =>
    setSetting<PetSettings>('pet', { ...pet, equipped: { ...pet.equipped, [c.kind]: on ? c.id : undefined } });

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Cosmetics</h3>
        <div className="flex gap-1 text-xs font-semibold">
          {(['hat', 'bg'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 ${tab === t ? 'bg-ember-500 text-night-950' : 'bg-night-800 text-zinc-400'}`}>
              {t === 'hat' ? '🎩 Hats' : '🖼️ Scenes'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {COSMETICS.filter((c) => c.kind === tab).map((c) => {
          const has = owned.has(c.id);
          const worn = g.worn[c.kind] === c.id;
          const locked = (c.minStage ?? 0) > g.game!.stage;
          const afford = g.game!.coins >= c.cost;
          return (
            <div key={c.id} className={`card overflow-hidden ${worn ? 'border-ember-500' : ''}`}>
              <div className="flex justify-center" style={{ background: c.kind === 'bg' ? sceneBackground(c.id, false, false) : 'var(--color-night-800)' }}>
                <PetView stage={stage} mood="happy" color={pet.color} size={96} animate={false} hat={c.kind === 'hat' ? c.id : g.worn.hat} />
              </div>
              <div className="space-y-1.5 p-2.5">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                {has ? (
                  <button onClick={() => wear(c, !worn)} className={`w-full rounded-full py-1.5 text-xs font-bold ${worn ? 'bg-night-700 text-zinc-300' : 'bg-ember-500 text-night-950'}`}>
                    {worn ? 'Take off' : c.kind === 'hat' ? 'Wear' : 'Use'}
                  </button>
                ) : locked ? (
                  <p className="rounded-full bg-night-800 py-1.5 text-center text-[11px] text-zinc-500">🔒 {RULES.stages[c.minStage!].name}</p>
                ) : (
                  <button
                    disabled={!afford}
                    onClick={() =>
                      onBuy({
                        itemId: cosmeticItemId(c.id),
                        name: c.name,
                        cost: c.cost,
                        icon: c.kind === 'hat' ? '🎩' : '🖼️',
                        after: () => wear(c, true),
                      })
                    }
                    className="w-full rounded-full bg-gold-400 py-1.5 text-xs font-bold text-night-950 disabled:bg-night-700 disabled:text-zinc-500"
                  >
                    {c.cost} 🪙
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
