import { readFile } from 'node:fs/promises';
import type { Day } from '../../src/core/date';
import type { GdStat, MusicCoachStat, ValorantRegion } from '../../src/core/integrations/types';
import { logicalDayTz } from './days';

type Fetch = typeof fetch;
const UA = 'Ember/0.1 (github.com/timodevgames/ember; personal habit tracker)';

// --- Music Coach ------------------------------------------------------------

interface McSession {
  startedAt?: number;
  endedAt?: number;
}

/** Sessions from Music Coach's own sync file (`server/data/sync-<port>.json`). */
export async function readMusicCoach(file: string): Promise<McSession[]> {
  const json = JSON.parse(await readFile(file, 'utf8')) as { data?: { sessions?: McSession[] }; sessions?: McSession[] };
  const sessions = json.sessions ?? json.data?.sessions;
  if (!Array.isArray(sessions)) throw new Error('no sessions array in Music Coach sync file');
  return sessions;
}

export function musicCoachDays(sessions: McSession[], tz: string, startHour: number): Map<Day, MusicCoachStat> {
  const out = new Map<Day, MusicCoachStat>();
  for (const s of sessions) {
    if (typeof s.startedAt !== 'number') continue;
    const ms = Math.max(0, Math.min((s.endedAt ?? s.startedAt) - s.startedAt, 3 * 3600_000)); // cap runaway sessions
    const day = logicalDayTz(s.startedAt, tz, startHour);
    const cur = out.get(day) ?? { minutes: 0, sessions: 0 };
    cur.minutes += ms / 60_000;
    cur.sessions += 1;
    out.set(day, cur);
  }
  for (const v of out.values()) v.minutes = Math.round(v.minutes);
  return out;
}

// --- Valorant (HenrikDev, unofficial) ----------------------------------------

export interface ValMatch {
  metadata: { started_at: string; game_length_in_ms?: number; is_completed?: boolean; queue?: { id?: string; name?: string } };
}

async function henrik<T>(path: string, key: string, fetchFn: Fetch): Promise<T> {
  const r = await fetchFn(`https://api.henrikdev.xyz${path}`, { headers: { authorization: key, 'user-agent': UA } });
  const body = (await r.json().catch(() => null)) as { data?: T; errors?: { message?: string }[] } | null;
  if (!r.ok || !body?.data) throw new Error(`HenrikDev ${r.status}: ${body?.errors?.[0]?.message ?? 'no data'}`);
  return body.data;
}

export function fetchValorantMatches(riot: { name: string; tag: string; region: ValorantRegion }, key: string, fetchFn: Fetch = fetch): Promise<ValMatch[]> {
  const p = `/valorant/v4/matches/${riot.region}/pc/${encodeURIComponent(riot.name)}/${encodeURIComponent(riot.tag)}?size=20`;
  return henrik<ValMatch[]>(p, key, fetchFn);
}

export async function fetchValorantRank(riot: { name: string; tag: string; region: ValorantRegion }, key: string, fetchFn: Fetch = fetch) {
  const p = `/valorant/v3/mmr/${riot.region}/pc/${encodeURIComponent(riot.name)}/${encodeURIComponent(riot.tag)}`;
  const d = await henrik<{ current?: { tier?: { name?: string }; rr?: number; elo?: number; last_change?: number } }>(p, key, fetchFn);
  return { tier: d.current?.tier?.name, rr: d.current?.rr, elo: d.current?.elo, lastChange: d.current?.last_change };
}

export function valorantDays(matches: ValMatch[], tz: string, startHour: number): Map<Day, { matches: number; minutes: number; modes: Record<string, number> }> {
  const out = new Map<Day, { matches: number; minutes: number; modes: Record<string, number> }>();
  for (const m of matches) {
    const t = Date.parse(m.metadata?.started_at);
    if (!Number.isFinite(t) || m.metadata.is_completed === false) continue;
    const day = logicalDayTz(t, tz, startHour);
    const cur = out.get(day) ?? { matches: 0, minutes: 0, modes: {} };
    cur.matches += 1;
    cur.minutes += Math.round((m.metadata.game_length_in_ms ?? 0) / 60_000);
    const mode = m.metadata.queue?.name ?? m.metadata.queue?.id ?? 'Other';
    cur.modes[mode] = (cur.modes[mode] ?? 0) + 1;
    out.set(day, cur);
  }
  return out;
}

// --- Geometry Dash (GDBrowser, unofficial) ------------------------------------

export async function fetchGdProfile(username: string, fetchFn: Fetch = fetch): Promise<GdStat> {
  const r = await fetchFn(`https://gdbrowser.com/api/profile/${encodeURIComponent(username)}`, { headers: { 'user-agent': UA } });
  const p = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!r.ok || !p || p === null || typeof p.stars !== 'number') throw new Error(`GDBrowser ${r.status}: profile not found`);
  const sum = (o: unknown) => (o && typeof o === 'object' ? Object.values(o as Record<string, number>).reduce((a, v) => a + (Number(v) || 0), 0) : 0);
  return {
    stars: Number(p.stars) || 0,
    diamonds: Number(p.diamonds) || 0,
    coins: Number(p.coins) || 0,
    userCoins: Number(p.userCoins) || 0,
    demons: Number(p.demons) || 0,
    moons: Number(p.moons) || 0,
    levels: sum(p.classicLevelsCompleted) + sum(p.platformerLevelsCompleted) + sum(p.classicDemonsCompleted) + sum(p.platformerDemonsCompleted),
  };
}

/** Which counters went up since the previous snapshot — any rise = "played GD". */
export function gdGains(prev: GdStat, cur: GdStat): Partial<Record<keyof GdStat, number>> {
  const out: Partial<Record<keyof GdStat, number>> = {};
  for (const k of Object.keys(cur) as (keyof GdStat)[]) {
    const d = cur[k] - (prev[k] ?? 0);
    if (d > 0) out[k] = d;
  }
  return out;
}
