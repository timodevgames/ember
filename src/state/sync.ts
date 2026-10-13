import { useSyncExternalStore } from 'react';
import { db } from '../db/db';
import { deviceId, getMeta, onLocalChange, setMeta } from '../db/repo';
import { SYNCED_TABLES, type SyncFields } from '../db/types';
import { isSandbox } from '../core/sandbox';
import type { Change, SyncResponse } from '../core/sync/protocol';

/**
 * Client side of the habits-api sync. Local-first: the app never waits for the
 * server. We push this device's records changed since the last push and pull
 * everything after our server cursor; both sides keep the newer `updatedAt`.
 * Remote rows are written with plain Dexie calls (not repo.save) so they don't
 * echo back as local changes.
 */

export interface SyncConfig {
  url: string;
  token: string;
}

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error';
  lastSyncAt?: number;
  error?: string;
}

const K = { config: 'sync.config', cursor: 'sync.cursor', lastPush: 'sync.lastPushAt', lastPushIds: 'sync.lastPushIds', lastSync: 'sync.lastSyncAt' };
export const DEFAULT_SERVER = 'https://paraesthetic-hilary-guidingly.ngrok-free.dev/habits';

// --- status store -----------------------------------------------------------

let status: SyncStatus = { state: 'off' };
const listeners = new Set<() => void>();
function setStatus(s: SyncStatus) {
  status = s;
  for (const l of listeners) l();
}
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

// --- pairing ----------------------------------------------------------------

export function parsePairing(code: string): SyncConfig | null {
  const c = code.trim();
  if (!c.startsWith('ember:')) return null;
  try {
    const b64 = c.slice(6).replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(decodeURIComponent(escape(atob(b64)))) as Partial<SyncConfig>;
    if (typeof json.url === 'string' && typeof json.token === 'string' && json.token.length >= 24) return { url: json.url.replace(/\/+$/, ''), token: json.token };
  } catch {
    /* fall through */
  }
  return null;
}

export function makePairing(cfg: SyncConfig): string {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
  return 'ember:' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function getSyncConfig(): Promise<SyncConfig | null> {
  if (isSandbox()) return null;
  return getMeta<SyncConfig | null>(K.config, null);
}

// --- transport --------------------------------------------------------------

export async function call<T>(cfg: SyncConfig, path: string, body: object, timeoutMs = 20_000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    // text/plain + token in the body = a CORS "simple" request: no preflight.
    const r = await fetch(cfg.url + path, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ token: cfg.token, ...body }), signal: ctl.signal });
    const json = (await r.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
    if (r.status === 401) throw new Error('The sync token was rejected. Paste the pairing code again.');
    if (!r.ok || !json) throw new Error(json?.error ?? `Server answered HTTP ${r.status}`);
    return json;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('The server took too long to answer.');
    if (e instanceof TypeError) throw new Error(navigator.onLine ? "Can't reach your Pixel server right now." : 'You are offline.');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function checkServer(cfg: SyncConfig): Promise<{ hasData: boolean }> {
  const r = await call<Extract<SyncResponse, { ok: true }>>(cfg, '/sync', { deviceId: deviceId(), since: 0, changes: [] });
  // Server-written rows (integration stats/status) don't count — only a real pet or habits do.
  return { hasData: r.changes.some((c) => c.table === 'habits' || (c.table === 'settings' && c.record.id === 'pet')) };
}

// --- sync -------------------------------------------------------------------

/**
 * This device's rows changed since the last push. `≥ lastPushAt` so a row saved
 * in the same millisecond as the last push isn't skipped; the rows already
 * pushed at exactly that millisecond (`pushedAtBoundary`) are left out so a
 * bulk save isn't re-uploaded on every sync.
 */
async function collect(lastPushAt: number, pushedAtBoundary: string[], everything: boolean): Promise<{ changes: Change[]; maxUpdatedAt: number; boundary: string[] }> {
  const me = deviceId();
  const done = new Set(pushedAtBoundary);
  const changes: Change[] = [];
  let maxUpdatedAt = lastPushAt;
  for (const t of SYNCED_TABLES) {
    const rows = (await db.table(t).where('updatedAt').aboveOrEqual(lastPushAt).toArray()) as SyncFields[];
    for (const r of rows) {
      if (!everything && r.deviceId !== me) continue; // pulled from elsewhere — don't echo it back
      if (r.updatedAt === lastPushAt && done.has(`${t}/${r.id}`)) continue;
      changes.push({ table: t, record: r as Change['record'] });
      maxUpdatedAt = Math.max(maxUpdatedAt, r.updatedAt);
    }
  }
  const boundary = changes.filter((c) => c.record.updatedAt === maxUpdatedAt).map((c) => `${c.table}/${c.record.id}`);
  // Nothing new at a later time: keep remembering what was already sent at this millisecond.
  return { changes, maxUpdatedAt, boundary: maxUpdatedAt === lastPushAt ? [...done, ...boundary] : boundary };
}

async function applyRemote(changes: Change[]): Promise<number> {
  let n = 0;
  if (changes.length === 0) return 0;
  await db.transaction('rw', SYNCED_TABLES.map((t) => db.table(t)), async () => {
    for (const c of changes) {
      if (!(SYNCED_TABLES as readonly string[]).includes(c.table)) continue;
      const table = db.table(c.table);
      const cur = (await table.get(c.record.id)) as SyncFields | undefined;
      if (!cur || cur.updatedAt < c.record.updatedAt) {
        await table.put(c.record);
        n++;
      }
    }
  });
  return n;
}

/** Ask the server to run the auto-checks right away, then pull the results. */
export async function runIntegrationsNow(): Promise<void> {
  const cfg = await getSyncConfig();
  if (!cfg) throw new Error('Connect sync first — the auto-checks run on your Pixel server.');
  await call(cfg, '/integrations/run', {}, 60_000);
  await syncNow();
}

let running = false;
let again = false;

export async function syncNow(): Promise<void> {
  const cfg = await getSyncConfig();
  if (!cfg) {
    setStatus({ state: 'off' });
    return;
  }
  if (running) {
    again = true;
    return;
  }
  running = true;
  setStatus({ ...status, state: 'syncing', error: undefined });
  try {
    for (let round = 0; round < 50; round++) {
      const lastPushAt = await getMeta<number>(K.lastPush, 0);
      const cursor = await getMeta<number>(K.cursor, 0);
      // The very first push sends everything (also rows imported from a backup).
      const pushedAtBoundary = await getMeta<string[]>(K.lastPushIds, []);
      const { changes, maxUpdatedAt, boundary } = await collect(lastPushAt, pushedAtBoundary, lastPushAt === 0 && cursor === 0);
      const r = await call<Extract<SyncResponse, { ok: true }>>(cfg, '/sync', { deviceId: deviceId(), since: cursor, changes });
      await applyRemote(r.changes);
      await setMeta(K.lastPush, Math.max(lastPushAt, maxUpdatedAt, 1));
      await setMeta(K.lastPushIds, boundary);
      await setMeta(K.cursor, r.cursor);
      if (!r.more) break;
    }
    const now = Date.now();
    await setMeta(K.lastSync, now);
    setStatus({ state: 'idle', lastSyncAt: now });
  } catch (e) {
    setStatus({ state: 'error', lastSyncAt: status.lastSyncAt, error: (e as Error).message });
  } finally {
    running = false;
    if (again) {
      again = false;
      setTimeout(syncNow, 300);
    }
  }
}

/**
 * Connect this device. `replaceLocal` wipes this device's synced data first —
 * the right choice when the server already has your real pet and this device
 * only has a test/duplicate one.
 */
export async function connect(cfg: SyncConfig, replaceLocal: boolean): Promise<void> {
  if (replaceLocal) {
    await db.transaction('rw', SYNCED_TABLES.map((t) => db.table(t)), async () => {
      for (const t of SYNCED_TABLES) await db.table(t).clear();
    });
  }
  await setMeta(K.config, cfg);
  await setMeta(K.cursor, 0);
  await setMeta(K.lastPush, 0);
  await setMeta(K.lastPushIds, []);
  await syncNow();
}

/** After a backup import: push everything again on the next sync (the server keeps whatever is newer). */
export async function resyncEverything(): Promise<void> {
  await setMeta(K.lastPush, 0);
  await setMeta(K.lastPushIds, []);
  await setMeta(K.cursor, 0);
  void syncNow();
}

export async function disconnect(): Promise<void> {
  await setMeta(K.config, null);
  setStatus({ state: 'off' });
}

let started = false;

/** Call once at startup: syncs on launch, after local edits, when the app comes back, every minute. */
export function startSync(): void {
  if (started || isSandbox()) return;
  started = true;
  getMeta<number>(K.lastSync, 0).then((t) => {
    if (t) status = { ...status, lastSyncAt: t };
  });
  let debounce = 0;
  onLocalChange(() => {
    clearTimeout(debounce);
    debounce = window.setTimeout(syncNow, 1500);
  });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow());
  window.addEventListener('online', () => syncNow());
  setInterval(() => document.visibilityState === 'visible' && syncNow(), 60_000);
  syncNow();
}
