import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useGame } from '../../state/game';
import { db } from '../../db/db';
import { alive } from '../../db/repo';
import type { Reward } from '../../db/types';
import { RULES } from '../../core/game/rules';
import { buy, deleteReward, saveReward } from '../../state/actions';
import PageHeader from '../../components/PageHeader';
import Sheet from '../../components/Sheet';

type Pending = { itemId: string; name: string; cost: number; icon: string } | null;

export default function ShopPage() {
  const g = useGame();
  const rewards = useLiveQuery(async () => alive(await db.rewards.toArray()).sort((a, b) => a.cost - b.cost));
  const [pending, setPending] = useState<Pending>(null);
  const [done, setDone] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Reward> | null>(null);
  if (!g?.game) return null;
  const { game } = g;
  const atMax = game.freezes >= RULES.freeze.maxHeld;
  const redeemed = [...g.purchases].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);

  return (
    <div className="space-y-4 pb-6">
      <PageHeader title="Shop" back="/pet" right={<span className="rounded-full bg-night-800 px-3 py-1.5 font-bold text-gold-400">🪙 {game.coins}</span>} />

      <section className="card flex items-center gap-3 p-4">
        <span className="text-4xl">❄️</span>
        <div className="flex-1">
          <p className="font-semibold">Streak freeze</p>
          <p className="text-xs text-zinc-400">
            Saves your streak and HP on one bad day. You hold {game.freezes}/{RULES.freeze.maxHeld}.
          </p>
        </div>
        <BuyButton cost={RULES.freeze.cost} coins={game.coins} disabled={atMax} label={atMax ? 'Full' : undefined} onClick={() => setPending({ itemId: 'freeze', name: 'Streak freeze', cost: RULES.freeze.cost, icon: '❄️' })} />
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Real-life rewards</h3>
          <button onClick={() => setEditing({ name: '', icon: '🎁', cost: 300 })} className="text-sm font-semibold text-ember-400">
            + Add
          </button>
        </div>
        {(rewards ?? []).map((r) => (
          <div key={r.id} className="card flex items-center gap-3 px-4 py-3">
            <button onClick={() => setEditing(r)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="text-3xl">{r.icon}</span>
              <span className="truncate font-semibold">{r.name}</span>
            </button>
            <BuyButton cost={r.cost} coins={game.coins} onClick={() => setPending({ itemId: `reward:${r.id}`, name: r.name, cost: r.cost, icon: r.icon })} />
          </div>
        ))}
        {rewards?.length === 0 && (
          <p className="card px-4 py-4 text-sm text-zinc-400">
            Add treats you actually want — "order pizza", "new GD icon kit", "1 h extra gaming" — and earn them with coins.
          </p>
        )}
      </section>

      {redeemed.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Recently redeemed</h3>
          {redeemed.map((p) => (
            <div key={p.id} className="flex justify-between px-1 text-sm text-zinc-400">
              <span className="truncate">{p.name}</span>
              <span className="shrink-0 tabular-nums">
                {p.day} · −{p.cost} 🪙
              </span>
            </div>
          ))}
        </section>
      )}

      <Sheet open={!!pending} onClose={() => setPending(null)} title="Redeem?" center>
        {pending && (
          <>
            <p className="mb-4 text-center text-5xl">{pending.icon}</p>
            <p className="mb-4 text-center">
              <b>{pending.name}</b> for <b className="text-gold-400">{pending.cost} 🪙</b>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPending(null)} className="rounded-xl bg-night-800 py-3 font-semibold">
                Not now
              </button>
              <button
                onClick={async () => {
                  await buy(pending.itemId, pending.name, pending.cost, g.today);
                  setDone(pending.itemId === 'freeze' ? 'Freeze stored. Your streak is safer now ❄️' : `Enjoy it — you earned "${pending.name}" 🎉`);
                  setPending(null);
                }}
                className="rounded-xl bg-gold-400 py-3 font-bold text-night-950"
              >
                Redeem
              </button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={!!done} onClose={() => setDone(null)} center>
        <p className="py-2 text-center text-lg font-semibold">{done}</p>
        <button onClick={() => setDone(null)} className="mt-3 w-full rounded-xl bg-night-800 py-3 font-semibold">
          Nice
        </button>
      </Sheet>

      <RewardEditor reward={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function BuyButton({ cost, coins, onClick, disabled, label }: { cost: number; coins: number; onClick: () => void; disabled?: boolean; label?: string }) {
  const afford = coins >= cost;
  return (
    <button
      onClick={onClick}
      disabled={disabled || !afford}
      className="shrink-0 rounded-full bg-gold-400 px-4 py-2 text-sm font-bold text-night-950 disabled:bg-night-700 disabled:text-zinc-500"
    >
      {label ?? `${cost} 🪙`}
    </button>
  );
}

function RewardEditor({ reward, onClose }: { reward: Partial<Reward> | null; onClose: () => void }) {
  const [draft, setDraft] = useState<Partial<Reward>>({});
  const open = !!reward;
  const cur = { ...reward, ...draft };
  const close = () => {
    setDraft({});
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title={reward?.id ? 'Edit reward' : 'New reward'}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input value={cur.icon ?? ''} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} className="w-14 rounded-xl border border-night-600 bg-night-800 py-2.5 text-center text-xl" aria-label="Icon" maxLength={4} />
          <input value={cur.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Order pizza" className="min-w-0 flex-1 rounded-xl border border-night-600 bg-night-800 px-3 py-2.5" aria-label="Reward name" />
        </div>
        <label className="flex items-center gap-3 text-sm text-zinc-400">
          Cost
          <input type="number" min={10} step={10} value={cur.cost ?? 0} onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) })} className="w-28 rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-zinc-100" />
          🪙
        </label>
        <p className="text-xs text-zinc-500">A full day of habits earns roughly 40–60 coins.</p>
        <div className="flex gap-2">
          {reward?.id && (
            <button
              onClick={async () => {
                await deleteReward(reward.id!);
                close();
              }}
              className="rounded-xl bg-hp-500/15 px-4 py-3 font-semibold text-hp-400"
            >
              Delete
            </button>
          )}
          <button
            disabled={!cur.name?.trim() || !cur.cost}
            onClick={async () => {
              await saveReward({ id: reward?.id, name: cur.name!.trim(), icon: cur.icon || '🎁', cost: Math.max(10, Math.round(cur.cost!)) });
              close();
            }}
            className="flex-1 rounded-xl bg-ember-500 py-3 font-bold text-night-950 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}
