/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from './store';
import { logicalDayTz } from './integrations/days';
import { gdGains, musicCoachDays, valorantDays } from './integrations/sources';
import { runIntegrations } from './integrations/runner';
import type { Change } from '../src/core/sync/protocol';

const TZ = 'Europe/Berlin';
// 2026-10-13 21:00 Berlin (CEST, UTC+2)
const NOW = Date.UTC(2026, 9, 13, 19, 0);

describe('logical days in a time zone', () => {
  it('uses the user zone and the 04:00 boundary', () => {
    expect(logicalDayTz(Date.UTC(2026, 9, 13, 23, 30), TZ, 4)).toBe('2026-10-13'); // 01:30 Berlin next day
    expect(logicalDayTz(Date.UTC(2026, 9, 14, 2, 30), TZ, 4)).toBe('2026-10-14'); // 04:30 Berlin
    expect(logicalDayTz(Date.UTC(2026, 9, 13, 23, 30), 'America/New_York', 4)).toBe('2026-10-13');
  });
});

describe('sources', () => {
  it('sums Music Coach minutes per logical day and caps runaway sessions', () => {
    const d = musicCoachDays(
      [
        { startedAt: NOW - 3600_000, endedAt: NOW - 3000_000 },
        { startedAt: NOW, endedAt: NOW + 600_000 },
        { startedAt: NOW - 86_400_000, endedAt: NOW - 86_400_000 + 10 * 3600_000 },
      ],
      TZ,
      4,
    );
    expect(d.get('2026-10-13')).toEqual({ minutes: 20, sessions: 2 });
    expect(d.get('2026-10-12')?.minutes).toBe(180);
  });
  it('groups Valorant matches by day and mode', () => {
    const d = valorantDays(
      [
        { metadata: { started_at: '2026-10-10T19:52:57.377Z', game_length_in_ms: 860798, is_completed: true, queue: { name: 'Unrated' } } },
        { metadata: { started_at: '2026-10-10T12:56:05.282Z', game_length_in_ms: 1492041, is_completed: true, queue: { name: 'Competitive' } } },
        { metadata: { started_at: '2026-10-10T12:00:00.000Z', is_completed: false } },
      ],
      TZ,
      4,
    );
    expect(d.get('2026-10-10')).toEqual({ matches: 2, minutes: 39, modes: { Unrated: 1, Competitive: 1 } });
  });
  it('detects GD progress', () => {
    const a = { stars: 420, diamonds: 1470, coins: 88, userCoins: 9, demons: 10, moons: 63, levels: 70 };
    expect(gdGains(a, { ...a, diamonds: 1490, stars: 423 })).toEqual({ diamonds: 20, stars: 3 });
    expect(gdGains(a, a)).toEqual({});
  });
});

describe('runner', () => {
  const habit = (id: string, autoSource: string, kind: string, target = 1): Change => ({
    table: 'habits',
    record: { id, updatedAt: 1, name: id, icon: '', category: 'other', kind, target, schedule: { type: 'daily' }, difficulty: 'easy', order: 0, createdDay: '2026-10-01', autoSource },
  });

  function setup() {
    const store = new Store(':memory:');
    store.merge([
      habit('piano', 'musicCoach', 'duration', 15),
      habit('val', 'valorant', 'check'),
      habit('gd', 'geometryDash', 'check'),
      { table: 'settings', record: { id: 'integrations', updatedAt: 1, value: { timeZone: TZ, riot: { name: 'timodevgames', tag: 'tdg', region: 'eu' }, gdUsername: 'TimoDevGames', musicCoachPort: 5173 } } },
    ]);
    const dir = mkdtempSync(join(tmpdir(), 'ember-mc-'));
    writeFileSync(join(dir, 'sync-5173.json'), JSON.stringify({ version: 1, sessions: [{ startedAt: NOW - 1800_000, endedAt: NOW - 600_000 }] }));
    let gd = { stars: 420, diamonds: 1470, coins: 88, userCoins: 9, demons: 10, moons: 63 };
    const fetchImpl = (async (url: string) => {
      if (url.includes('/v4/matches/'))
        return Response.json({ status: 200, data: [{ metadata: { started_at: new Date(NOW - 7200_000).toISOString(), game_length_in_ms: 1_800_000, is_completed: true, queue: { name: 'Competitive' } } }] });
      if (url.includes('/v3/mmr/')) return Response.json({ status: 200, data: { current: { tier: { name: 'Silver 2' }, rr: 12, elo: 712, last_change: -27 } } });
      if (url.includes('gdbrowser.com')) return Response.json(gd);
      return new Response('nope', { status: 404 });
    }) as unknown as typeof fetch;
    let now = NOW;
    const env = { henrikKey: 'HDEV-test', musicCoachDir: dir, defaults: {}, fetchImpl, now: () => now };
    return { store, env, setGd: (g: typeof gd) => (gd = g), setNow: (t: number) => (now = t) };
  }

  it('writes auto logs once and is idempotent', async () => {
    const { store, env, setNow } = setup();
    const r = await runIntegrations(store, env);
    expect(r.valorant?.message).toBe('Silver 2 · 1 match today');
    expect(r.musicCoach?.message).toBe('20 min in 1 session today');
    expect(store.get('habitLogs', 'auto:musicCoach:piano:2026-10-13')?.value).toBe(20);
    expect(store.get('habitLogs', 'auto:valorant:val:2026-10-13')?.value).toBe(1);
    expect(store.get('integrationStats', 'stat:valorant:2026-10-13')?.data).toMatchObject({ tier: 'Silver 2', matches: 1 });
    expect(r.geometryDash?.message).toMatch(/Baseline/);
    expect(store.get('habitLogs', 'auto:geometryDash:gd:2026-10-13')).toBeUndefined();

    const seqBefore = store.since(0).cursor;
    await runIntegrations(store, env);
    expect(store.since(seqBefore).changes).toEqual([]); // same moment, nothing new
    setNow(NOW + 60_000);
    await runIntegrations(store, env);
    // a no-news run a minute later only refreshes the three status rows
    expect(store.since(seqBefore).changes.map((c) => c.record.id).sort()).toEqual(['status:geometryDash', 'status:musicCoach', 'status:valorant']);
  });

  it('marks GD done on the next day when counters rise', async () => {
    const { store, env, setGd, setNow } = setup();
    await runIntegrations(store, env);
    setNow(NOW + 86_400_000);
    setGd({ stars: 423, diamonds: 1490, coins: 88, userCoins: 9, demons: 10, moons: 63 });
    const r = await runIntegrations(store, env);
    expect(r.geometryDash?.message).toBe('Today: +3 stars, +20 diamonds');
    expect(store.get('habitLogs', 'auto:geometryDash:gd:2026-10-14')?.value).toBe(1);
  });

  it('reports missing config instead of failing', async () => {
    const { store, env } = setup();
    store.merge([{ table: 'settings', record: { id: 'integrations', updatedAt: 2, value: { timeZone: TZ } } }]);
    const r = await runIntegrations(store, { ...env, henrikKey: undefined });
    expect(r.valorant?.ok).toBe(false);
    expect(r.geometryDash?.message).toMatch(/username/);
  });
});
