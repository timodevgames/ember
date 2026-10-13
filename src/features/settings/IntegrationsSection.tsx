import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { getSetting, setSetting } from '../../db/settings';
import type { AutoSource } from '../../db/types';
import { AUTO_SOURCES } from '../../core/habits/templates';
import { parseRiotId, VALORANT_REGIONS, type IntegrationSettings, type IntegrationStatus, type ValorantRegion } from '../../core/integrations/types';
import { runIntegrationsNow } from '../../state/sync';

/**
 * Accounts the Pixel server checks every 30 min (Riot ID, GD username, Music
 * Coach instance). Saved as the synced setting `integrations`; the server's
 * last result per source comes back as `integrationStats/status:<source>`.
 */
export default function IntegrationsSection() {
  const saved = useLiveQuery(() => getSetting<IntegrationSettings | null>('integrations', null));
  const statuses = useLiveQuery(async () => {
    const rows = await db.integrationStats.where('id').startsWith('status:').toArray();
    return rows.filter((r) => !r.deleted);
  });
  const [riot, setRiot] = useState('');
  const [region, setRegion] = useState<ValorantRegion>('eu');
  const [gd, setGd] = useState('');
  const [port, setPort] = useState(5173);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (saved === undefined || loaded) return;
    if (saved?.riot) {
      setRiot(`${saved.riot.name}#${saved.riot.tag}`);
      setRegion(saved.riot.region);
    }
    if (saved?.gdUsername) setGd(saved.gdUsername);
    if (saved?.musicCoachPort) setPort(saved.musicCoachPort);
    setLoaded(true);
  }, [saved, loaded]);

  const riotParsed = riot.trim() ? parseRiotId(riot) : null;
  const riotInvalid = riot.trim() !== '' && !riotParsed;

  const save = async () => {
    const value: IntegrationSettings = {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      riot: riotParsed ? { ...riotParsed, region } : undefined,
      gdUsername: gd.trim() || undefined,
      musicCoachPort: port,
    };
    await setSetting('integrations', value);
    setMsg('Saved.');
  };

  const checkNow = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await save();
      // give the save a moment to reach the server before it runs
      await new Promise((r) => setTimeout(r, 1800));
      await runIntegrationsNow();
      setMsg('Checked just now.');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const byId = new Map((statuses ?? []).map((s) => [s.source, s.data as unknown as IntegrationStatus]));

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">Your Pixel server checks these every 30 minutes and ticks the matching habits for you. Until you save here it uses the accounts in its own config.</p>

      <div className="space-y-1.5">
        {(['musicCoach', 'valorant', 'geometryDash'] as AutoSource[]).map((s) => {
          const st = byId.get(s);
          return (
            <div key={s} className="flex items-start gap-2 rounded-xl bg-night-800 px-3 py-2 text-sm">
              <span>{AUTO_SOURCES[s].icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{AUTO_SOURCES[s].label}</span>
                <span className={`block text-xs ${!st ? 'text-zinc-500' : st.ok ? 'text-emerald-300' : 'text-hp-400'}`}>
                  {!st ? 'Not checked yet' : `${st.ok ? '✓' : '⚠️'} ${st.message}`}
                </span>
              </span>
              {st && <span className="shrink-0 text-[10px] text-zinc-500">{ago(st.lastRun)}</span>}
            </div>
          );
        })}
      </div>

      <label className="block text-sm text-zinc-400">
        Riot ID
        <div className="mt-1 flex gap-2">
          <input value={riot} onChange={(e) => setRiot(e.target.value)} placeholder="Name#TAG" className="min-w-0 flex-1 rounded-xl border border-night-600 bg-night-800 px-3 py-2.5 text-zinc-100" autoCapitalize="off" autoCorrect="off" />
          <select value={region} onChange={(e) => setRegion(e.target.value as ValorantRegion)} className="rounded-xl border border-night-600 bg-night-800 px-2 text-zinc-100" aria-label="Valorant region">
            {VALORANT_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        {riotInvalid && <span className="text-xs text-hp-400">Use the format Name#TAG.</span>}
      </label>

      <label className="block text-sm text-zinc-400">
        Geometry Dash username
        <input value={gd} onChange={(e) => setGd(e.target.value)} placeholder="Username" className="mt-1 w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2.5 text-zinc-100" autoCapitalize="off" autoCorrect="off" />
      </label>

      <label className="flex items-center justify-between text-sm text-zinc-400">
        Music Coach instance
        <select value={port} onChange={(e) => setPort(Number(e.target.value))} className="rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-zinc-100">
          <option value={5173}>Music-Couch 1 (5173)</option>
          <option value={5174}>Music-Couch 2 (5174)</option>
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={save} disabled={riotInvalid} className="rounded-xl bg-night-800 py-2.5 text-sm font-semibold disabled:opacity-40">
          Save
        </button>
        <button onClick={checkNow} disabled={busy || riotInvalid} className="rounded-xl bg-ember-500 py-2.5 text-sm font-bold text-night-950 disabled:opacity-40">
          {busy ? 'Checking…' : 'Check now'}
        </button>
      </div>
      {msg && <p className="text-sm text-zinc-300">{msg}</p>}
      <p className="text-xs text-zinc-500">
        Valorant uses the unofficial HenrikDev API and GD the unofficial GDBrowser API — if one breaks, just tick the habit yourself. GD can only see new stars, diamonds, moons or levels, not time played.
      </p>
    </div>
  );
}

function ago(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} d`;
}
