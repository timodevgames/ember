import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PALETTES, type PetColor } from '../../core/game/pet';
import { TEMPLATES } from '../../core/habits/templates';
import { RULES } from '../../core/game/rules';
import { saveHabit } from '../../state/actions';
import { setMeta } from '../../db/repo';
import { setSetting, type PetSettings } from '../../db/settings';
import type { Day } from '../../core/date';
import PetView from '../pet/PetView';
import Sheet from '../../components/Sheet';
import { PairingForm } from '../settings/SyncSection';

export default function Onboarding({ today }: { today: Day }) {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('Ember');
  const [color, setColor] = useState<PetColor>('ember');
  const [picked, setPicked] = useState<Set<string>>(new Set(['piano', 'valorant', 'gd']));
  const [pairing, setPairing] = useState(false);

  const finish = async () => {
    let order = 0;
    for (const t of TEMPLATES.filter((t) => picked.has(t.key))) {
      const { key: _key, blurb: _blurb, ...h } = t;
      await saveHabit({ ...h, order: order++, createdDay: today });
    }
    await setMeta('seenStage', 0);
    await setSetting<PetSettings>('pet', { name: name.trim() || 'Ember', color, startDay: today });
    nav('/', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-safe pt-safe">
      <div className="flex flex-1 flex-col justify-center py-8">
        {step === 0 && (
          <div className="animate-rise-in space-y-5 text-center">
            <div className="flex justify-center">
              <PetView stage={0} mood="egg" color={color} eggProgress={0.2} size={200} />
            </div>
            <h1 className="text-3xl font-extrabold">You found an egg.</h1>
            <p className="text-zinc-300">
              Something warm is inside. It grows from everything you do regularly — practice, games, good food — and it needs you every day.
            </p>
            <label className="block text-left text-sm text-zinc-400">
              Name it
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} className="mt-1 w-full rounded-xl border border-night-600 bg-night-800 px-3 py-3 text-lg text-zinc-100" />
            </label>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(PALETTES) as PetColor[]).map((c) => (
                <button key={c} onClick={() => setColor(c)} className={`rounded-xl p-1 ${color === c ? 'bg-night-700 ring-2 ring-ember-500' : 'bg-night-800'}`} aria-pressed={color === c} aria-label={PALETTES[c].label}>
                  <PetView stage={2} mood="happy" color={c} size={52} animate={false} />
                </button>
              ))}
            </div>
            <button onClick={() => setPairing(true)} className="text-sm text-zinc-400 underline underline-offset-4">
              Already using Ember on another device? Connect sync
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="animate-rise-in space-y-3">
            <h1 className="text-2xl font-extrabold">What do you want to do regularly?</h1>
            <p className="text-sm text-zinc-400">Pick a few to start. You can change everything later — fewer habits you actually do beat many you skip.</p>
            <div className="space-y-2">
              {TEMPLATES.map((t) => {
                const on = picked.has(t.key);
                return (
                  <button
                    key={t.key}
                    onClick={() => {
                      const next = new Set(picked);
                      if (on) next.delete(t.key);
                      else next.add(t.key);
                      setPicked(next);
                    }}
                    aria-pressed={on}
                    className={`card flex w-full items-center gap-3 px-3.5 py-3 text-left ${on ? 'border-ember-500 bg-night-800' : ''}`}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.name}</span>
                      <span className="block text-xs text-zinc-400">{t.blurb}</span>
                    </span>
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-sm ${on ? 'bg-ember-500 text-night-950' : 'bg-night-700'}`}>{on ? '✓' : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-rise-in space-y-4">
            <h1 className="text-2xl font-extrabold">How {name || 'Ember'} lives</h1>
            <Rule icon="✅" title="Do your habits" text="Each one gives bond XP and coins. Hard habits count more." />
            <Rule icon="❤️" title="Every night your day is scored" text={`80%+ heals ${RULES.hp.bands[0].delta} HP. Under 50% costs HP, a lazy day up to ${-RULES.hp.bands[3].delta}.`} />
            <Rule icon="🌲" title="Real stakes" text={`At 0 HP your pet runs away to the forest. ${RULES.rescue.days} strong days in a row bring it back — one evolution stage lower.`} />
            <Rule icon="❄️" title="Streak freezes" text={`Earn one every ${RULES.freeze.earnEvery}-day streak. It saves a bad day automatically. Sick or on holiday? Use vacation mode.`} />
            <Rule icon="🦊" title="Evolve" text="Egg → Hatchling → Kit → Three-Tail → Five-Tail Spirit → Nine-Tail Legend." />
          </div>
        )}
      </div>

      <div className="flex gap-2 pb-6">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="rounded-2xl bg-night-800 px-5 py-3.5 font-semibold">
            Back
          </button>
        )}
        <button
          onClick={() => (step < 2 ? setStep(step + 1) : finish())}
          disabled={step === 0 && !name.trim()}
          className="flex-1 rounded-2xl bg-ember-500 py-3.5 font-bold text-night-950 disabled:opacity-40"
        >
          {step === 0 ? 'Keep it warm' : step === 1 ? `Continue with ${picked.size} habit${picked.size === 1 ? '' : 's'}` : "Let's go"}
        </button>
      </div>
      <Sheet open={pairing} onClose={() => setPairing(false)} title="Connect to your synced pet">
        <PairingForm onDone={() => setPairing(false)} />
      </Sheet>
    </div>
  );
}

function Rule({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="card flex gap-3 p-3.5">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-zinc-400">{text}</p>
      </div>
    </div>
  );
}
