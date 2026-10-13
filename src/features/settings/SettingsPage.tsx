import { useRef, useState } from 'react';
import Dexie from 'dexie';
import { useGame } from '../../state/game';
import { setSetting, type PetSettings, type Prefs } from '../../db/settings';
import { downloadBackup, importBackup, type Backup } from '../../db/backup';
import { PALETTES, type PetColor } from '../../core/game/pet';
import { addDays } from '../../core/date';
import { deleteVacation, saveVacation } from '../../state/actions';
import { isSandbox, sandboxOffsetDays, setSandbox, setSandboxOffsetDays } from '../../core/sandbox';
import PageHeader from '../../components/PageHeader';
import PetView from '../pet/PetView';
import SyncSection from './SyncSection';
import { resyncEverything } from '../../state/sync';
import IntegrationsSection from './IntegrationsSection';
import RemindersSection from './RemindersSection';

export default function SettingsPage() {
  const g = useGame();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [vacTo, setVacTo] = useState<string>('');
  if (!g?.pet) return null;
  const pet = g.pet;
  const savePet = (patch: Partial<PetSettings>) => setSetting<PetSettings>('pet', { ...pet, ...patch });
  const savePrefs = (patch: Partial<Prefs>) => setSetting<Prefs>('prefs', { ...g.prefs, ...patch });
  const upcoming = g.vacations.filter((v) => v.to >= g.today).sort((a, b) => a.from.localeCompare(b.from));
  const sandbox = isSandbox();

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Settings" />

      <Section title="Sync (Pixel server)">
        <SyncSection />
      </Section>

      <Section title="Reminders">
        <RemindersSection />
      </Section>

      <Section title="Auto-checks">
        <IntegrationsSection />
      </Section>

      <Section title="Your pet">
        <label className="block text-sm text-zinc-400">
          Name
          <input defaultValue={pet.name} onBlur={(e) => e.target.value.trim() && savePet({ name: e.target.value.trim() })} className="mt-1 w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2.5 text-zinc-100" maxLength={20} />
        </label>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {(Object.keys(PALETTES) as PetColor[]).map((c) => (
            <button key={c} onClick={() => savePet({ color: c })} className={`rounded-xl p-1 ${pet.color === c ? 'bg-night-700 ring-2 ring-ember-500' : 'bg-night-800'}`} aria-label={PALETTES[c].label} aria-pressed={pet.color === c}>
              <PetView stage={2} mood="content" color={c} size={52} animate={false} />
              <span className="block text-[10px] text-zinc-400">{PALETTES[c].label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Day">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            New day starts at
            <span className="block text-xs text-zinc-500">Late-night sessions still count for the evening before.</span>
          </span>
          <select value={g.prefs.dayStartHour} onChange={(e) => savePrefs({ dayStartHour: Number(e.target.value) })} className="rounded-xl border border-night-600 bg-night-800 px-3 py-2">
            {[0, 1, 2, 3, 4, 5, 6].map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section title="Vacation / sick mode">
        <p className="mb-3 text-sm text-zinc-400">Pauses HP loss and keeps your streak. Habits you still do give XP. A break starts today — it can't erase days that already happened.</p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Until</span>
          <input type="date" min={g.today} value={vacTo || addDays(g.today, 6)} onChange={(e) => setVacTo(e.target.value)} className="rounded-xl border border-night-600 bg-night-800 px-3 py-2" aria-label="Vacation end" />
          <button onClick={() => saveVacation({ from: g.today, to: vacTo || addDays(g.today, 6) })} className="ml-auto rounded-xl bg-sky-500/20 px-3 py-2 text-sm font-semibold text-sky-300">
            Start today
          </button>
        </div>
        {upcoming.map((v) => (
          <div key={v.id} className="mt-2 flex items-center justify-between rounded-xl bg-night-800 px-3 py-2 text-sm">
            <span>
              🏖️ {v.from} → {v.to}
            </span>
            <button onClick={() => (v.from >= g.today ? deleteVacation(v.id) : saveVacation({ ...v, to: addDays(g.today, -1) }))} className="text-hp-400">
              End
            </button>
          </div>
        ))}
      </Section>

      <Section title="Backup">
        <p className="mb-3 text-sm text-zinc-400">Everything lives on this device (and on your Pixel server once sync is connected). A file backup now and then doesn't hurt.</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => downloadBackup()} className="rounded-xl bg-night-800 py-3 font-semibold">
            ⬇️ Export
          </button>
          <button onClick={() => fileRef.current?.click()} className="rounded-xl bg-night-800 py-3 font-semibold">
            ⬆️ Import
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const n = await importBackup(JSON.parse(await f.text()) as Backup);
              if (n > 0) await resyncEverything();
              setMsg(`Imported ${n} records.`);
            } catch (err) {
              setMsg(`Import failed: ${(err as Error).message}`);
            }
            e.target.value = '';
          }}
        />
        {msg && <p className="mt-2 text-sm text-zinc-300">{msg}</p>}
      </Section>

      <Section title="Sandbox & time machine">
        <p className="mb-3 text-sm text-zinc-400">
          A separate test world: skip days ahead and watch what happens to your pet. Your real data is never touched.
        </p>
        {sandbox ? (
          <>
            <p className="mb-2 text-sm">
              Sandbox is <b className="text-ember-400">on</b> · time offset <b>{sandboxOffsetDays()} days</b>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 7].map((n) => (
                <button key={n} onClick={() => { setSandboxOffsetDays(sandboxOffsetDays() + n); location.reload(); }} className="rounded-xl bg-night-800 py-2.5 text-sm font-semibold">
                  +{n} day{n > 1 ? 's' : ''}
                </button>
              ))}
              <button onClick={() => { setSandboxOffsetDays(0); location.reload(); }} className="rounded-xl bg-night-800 py-2.5 text-sm font-semibold">
                Reset time
              </button>
              <button
                onClick={async () => {
                  setSandboxOffsetDays(0);
                  await Dexie.delete('ember-sandbox');
                  location.reload();
                }}
                className="col-span-1 rounded-xl bg-hp-500/15 py-2.5 text-sm font-semibold text-hp-400"
              >
                Wipe
              </button>
              <button onClick={() => { setSandbox(false); location.reload(); }} className="col-span-2 rounded-xl bg-ember-500 py-2.5 text-sm font-bold text-night-950">
                Back to real data
              </button>
            </div>
          </>
        ) : (
          <button onClick={() => { setSandbox(true); location.reload(); }} className="w-full rounded-xl bg-night-800 py-3 font-semibold">
            🧪 Enter sandbox
          </button>
        )}
      </Section>

      <Section title="About">
        <p className="text-sm text-zinc-400">
          Ember — habits, food and a fox spirit that depends on you. Food data: Bundeslebensmittelschlüssel (BLS 4.0, Max Rubner-Institut) and Open Food Facts (ODbL).
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}
