import { join } from 'node:path';
import { addDays, dayRange, type Day } from '../../src/core/date';
import type { AutoSource, Habit } from '../../src/db/types';
import {
  autoLogId,
  parseRiotId,
  statId,
  statusId,
  type GdStat,
  type IntegrationSettings,
  type IntegrationStatus,
  type ValorantRegion,
} from '../../src/core/integrations/types';
import type { Change, SyncRecord } from '../../src/core/sync/protocol';
import type { Store } from '../store';
import { logicalDayTz } from './days';
import { fetchGdProfile, fetchValorantMatches, fetchValorantRank, gdGains, musicCoachDays, readMusicCoach, valorantDays } from './sources';

export interface RunEnv {
  henrikKey?: string;
  musicCoachDir: string;
  /** Fallbacks from the server .env until the app has saved its own settings. */
  defaults: { riotId?: string; region?: string; gdUsername?: string; musicCoachPort?: number };
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export type RunResult = Partial<Record<AutoSource, IntegrationStatus>> & { written: number };

/** How many past days auto-checks may (re)write. Older history stays as it is. */
const WINDOW_DAYS = 7;

/**
 * Turns Music Coach sessions, Valorant matches and Geometry Dash progress into
 * habit logs with fixed ids (`auto:<source>:<habitId>:<day>`), so re-runs update
 * instead of duplicating and nothing is written when nothing changed.
 */
export async function runIntegrations(store: Store, env: RunEnv): Promise<RunResult> {
  const now = env.now?.() ?? Date.now();
  const fetchFn = env.fetchImpl ?? fetch;
  const settings = (store.get('settings', 'integrations')?.value ?? {}) as Partial<IntegrationSettings>;
  const prefs = (store.get('settings', 'prefs')?.value ?? {}) as { dayStartHour?: number };
  const tz = settings.timeZone || 'Europe/Berlin';
  const startHour = prefs.dayStartHour ?? 4;
  const today = logicalDayTz(now, tz, startHour);
  const window = dayRange(addDays(today, -(WINDOW_DAYS - 1)), today);

  const habits = (store.all('habits') as unknown as Habit[]).filter(
    (h) => !h.deleted && h.autoSource && (!h.archivedDay || h.archivedDay > today),
  );
  const bySource = (s: AutoSource) => habits.filter((h) => h.autoSource === s);
  const writes: Change[] = [];
  const result: RunResult = { written: 0 };

  const rec = (r: Record<string, unknown>) => ({ ...r, updatedAt: now, deviceId: 'server', deleted: 0 }) as unknown as SyncRecord;
  const putAuto = (source: AutoSource, h: Habit, day: Day, value: number) => {
    if (day < h.createdDay || day < window[0]) return;
    const id = autoLogId(source, h.id, day);
    const cur = store.get('habitLogs', id);
    if (cur && !cur.deleted && cur.value === value) return;
    writes.push({ table: 'habitLogs', record: rec({ id, habitId: h.id, day, value, source, createdAt: (cur?.createdAt as number) ?? now }) });
  };
  const putStat = (source: AutoSource, day: Day, data: object) => {
    const id = statId(source, day);
    const cur = store.get('integrationStats', id);
    if (cur && JSON.stringify(cur.data) === JSON.stringify(data)) return;
    writes.push({ table: 'integrationStats', record: rec({ id, source, day, data }) });
  };
  const putStatus = (source: AutoSource, ok: boolean, message: string) => {
    result[source] = { ok, message, lastRun: now };
    writes.push({ table: 'integrationStats', record: rec({ id: statusId(source), source, day: today, data: { ok, message, lastRun: now } }) });
  };
  const valueFor = (h: Habit, count: number, minutes: number) => (h.kind === 'check' ? (count > 0 ? 1 : 0) : h.kind === 'count' ? count : minutes);

  // --- Music Coach: practice minutes from the app's own sync file -------------
  const mcHabits = bySource('musicCoach');
  if (mcHabits.length) {
    const port = settings.musicCoachPort ?? env.defaults.musicCoachPort ?? 5173;
    try {
      const days = musicCoachDays(await readMusicCoach(join(env.musicCoachDir, `sync-${port}.json`)), tz, startHour);
      for (const day of window) {
        const s = days.get(day);
        if (!s) continue;
        putStat('musicCoach', day, s);
        for (const h of mcHabits) putAuto('musicCoach', h, day, valueFor(h, s.sessions, s.minutes));
      }
      const t = days.get(today);
      putStatus('musicCoach', true, t ? `${t.minutes} min in ${t.sessions} session${t.sessions > 1 ? 's' : ''} today` : 'No Music Coach practice today yet');
    } catch (e) {
      putStatus('musicCoach', false, `Can't read Music Coach data (port ${port}): ${(e as Error).message}`);
    }
  }

  // --- Valorant: matches + rank via HenrikDev ---------------------------------
  const valHabits = bySource('valorant');
  const fallbackRiot = env.defaults.riotId ? parseRiotId(env.defaults.riotId) : null;
  const riot = settings.riot ?? (fallbackRiot ? { ...fallbackRiot, region: (env.defaults.region ?? 'eu') as ValorantRegion } : null);
  if (valHabits.length || riot) {
    if (!riot) putStatus('valorant', false, 'Add your Riot ID in Settings → Auto-checks');
    else if (!env.henrikKey) putStatus('valorant', false, 'No HenrikDev API key on the server');
    else {
      try {
        const days = valorantDays(await fetchValorantMatches(riot, env.henrikKey, fetchFn), tz, startHour);
        let rank = {};
        try {
          rank = await fetchValorantRank(riot, env.henrikKey, fetchFn);
        } catch {
          /* unranked or MMR endpoint down — matches still count */
        }
        for (const day of window) {
          const v = days.get(day);
          if (day === today) putStat('valorant', day, { ...rank, matches: v?.matches ?? 0, minutes: v?.minutes ?? 0, modes: v?.modes ?? {} });
          else if (v) putStat('valorant', day, v);
          if (v) for (const h of valHabits) putAuto('valorant', h, day, valueFor(h, v.matches, v.minutes));
        }
        const t = days.get(today);
        const tier = (rank as { tier?: string }).tier;
        putStatus('valorant', true, `${tier ? tier + ' · ' : ''}${t ? `${t.matches} match${t.matches > 1 ? 'es' : ''} today` : 'no matches today yet'}`);
      } catch (e) {
        putStatus('valorant', false, (e as Error).message);
      }
    }
  }

  // --- Geometry Dash: any new stars/diamonds/levels since the last day ---------
  const gdHabits = bySource('geometryDash');
  const gdUser = settings.gdUsername ?? env.defaults.gdUsername;
  if (gdHabits.length || gdUser) {
    if (!gdUser) putStatus('geometryDash', false, 'Add your Geometry Dash username in Settings → Auto-checks');
    else {
      try {
        const cur = await fetchGdProfile(gdUser, fetchFn);
        putStat('geometryDash', today, cur);
        const prev = (store.all('integrationStats') as unknown as { id: string; day: Day; data: GdStat }[])
          .filter((r) => r.id.startsWith('stat:geometryDash:') && r.day < today)
          .sort((a, b) => b.day.localeCompare(a.day))[0];
        if (!prev) putStatus('geometryDash', true, 'Baseline saved — new progress counts from the next day on');
        else {
          const gains = gdGains(prev.data, cur);
          const keys = Object.keys(gains) as (keyof GdStat)[];
          if (keys.length) for (const h of gdHabits) putAuto('geometryDash', h, today, 1);
          putStatus('geometryDash', true, keys.length ? `Today: ${keys.map((k) => `+${gains[k]} ${k}`).join(', ')}` : 'No new stars, diamonds or levels today yet');
        }
      } catch (e) {
        putStatus('geometryDash', false, (e as Error).message);
      }
    }
  }

  result.written = store.merge(writes);
  return result;
}
