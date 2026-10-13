import { useEffect, useState } from 'react';
import { DEFAULT_REMINDERS, disableReminders, enableReminders, getReminderPrefs, pushSupport, sendTestReminder, updateReminderPrefs, type ReminderPrefs } from '../../state/push';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const label = (h: number) => `${String(h).padStart(2, '0')}:00`;

export default function RemindersSection() {
  const [prefs, setPrefs] = useState<ReminderPrefs | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const support = pushSupport();

  useEffect(() => {
    getReminderPrefs().then(setPrefs);
  }, []);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (support === 'needs-install') {
    return (
      <p className="text-sm text-zinc-400">
        On iPhone, reminders only work in the installed app: tap <b>Share → Add to Home Screen</b> in Safari, then open Ember from the Home Screen and come back here.
      </p>
    );
  }
  if (support === 'unsupported') return <p className="text-sm text-zinc-400">This browser can't receive push notifications.</p>;
  if (prefs === undefined) return null;

  if (!prefs) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-400">An evening nudge when something is still open — with exactly what your pet would lose. Sent by your Pixel server, so sync must be connected.</p>
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              await enableReminders(DEFAULT_REMINDERS);
              setPrefs(DEFAULT_REMINDERS);
            }, 'Reminders are on. Try “Send a test”.')
          }
          className="w-full rounded-xl bg-ember-500 py-3 font-bold text-night-950 disabled:opacity-40"
        >
          {busy ? 'Turning on…' : '🔔 Turn on reminders'}
        </button>
        {msg && <p className="text-sm text-hp-400">{msg}</p>}
      </div>
    );
  }

  const change = (patch: Partial<ReminderPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    void run(() => updateReminderPrefs(next), 'Saved.');
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          Evening check
          <span className="block text-xs text-zinc-500">Only if something is still open</span>
        </span>
        <select value={prefs.evening ?? ''} onChange={(e) => change({ evening: e.target.value === '' ? null : Number(e.target.value) })} className="rounded-xl border border-night-600 bg-night-800 px-3 py-2">
          <option value="">Off</option>
          {HOURS.filter((h) => h >= 16 && h <= 23).map((h) => (
            <option key={h} value={h}>
              {label(h)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          Morning plan
          <span className="block text-xs text-zinc-500">What's due today + your pet's HP</span>
        </span>
        <select value={prefs.morning ?? ''} onChange={(e) => change({ morning: e.target.value === '' ? null : Number(e.target.value) })} className="rounded-xl border border-night-600 bg-night-800 px-3 py-2">
          <option value="">Off</option>
          {HOURS.filter((h) => h >= 5 && h <= 11).map((h) => (
            <option key={h} value={h}>
              {label(h)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button disabled={busy} onClick={() => run(sendTestReminder, 'Sent — it should arrive in a few seconds.')} className="rounded-xl bg-night-800 py-2.5 text-sm font-semibold disabled:opacity-40">
          Send a test
        </button>
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              await disableReminders();
              setPrefs(null);
            }, 'Reminders are off.')
          }
          className="rounded-xl bg-night-800 py-2.5 text-sm font-semibold text-hp-400 disabled:opacity-40"
        >
          Turn off
        </button>
      </div>
      {msg && <p className="text-sm text-zinc-300">{msg}</p>}
    </div>
  );
}
