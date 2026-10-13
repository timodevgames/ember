#!/usr/bin/env node
/**
 * habits-api — Ember's sync server on the Pixel (pm2, port 3040, behind the
 * edge-proxy at /habits). Zero runtime dependencies: node:http + node:sqlite.
 *
 *   PORT=3040 SYNC_TOKEN=… DATA_DIR=./data node index.mjs
 *   (pm2 passes --env-file=.env)
 */
import { createServer } from 'node:http';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store';
import { createHandler } from './app';
import { runIntegrations, type RunEnv } from './integrations/runner';

declare const __VERSION__: string;

const PORT = Number(process.env.PORT || 3040);
const TOKEN = process.env.SYNC_TOKEN ?? '';
const DATA_DIR = process.env.DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), 'data');

if (TOKEN.length < 24) {
  console.error('SYNC_TOKEN missing or too short (need ≥ 24 chars) — refusing to start.');
  process.exit(1);
}

mkdirSync(DATA_DIR, { recursive: true });
const store = new Store(join(DATA_DIR, 'ember.sqlite'));
const runEnv: RunEnv = {
  henrikKey: process.env.HENRIK_API_KEY,
  musicCoachDir: process.env.MUSIC_COACH_DIR || join(process.env.HOME ?? '', 'apps/Music-Couch/server/data'),
  defaults: {
    riotId: process.env.RIOT_ID,
    region: process.env.RIOT_REGION,
    gdUsername: process.env.GD_USERNAME,
    musicCoachPort: process.env.MUSIC_COACH_PORT ? Number(process.env.MUSIC_COACH_PORT) : undefined,
  },
};

// One run at a time; a "Check now" during a run waits for that run instead of starting another.
let running: Promise<unknown> | null = null;
let lastRunAt = 0;
let lastResult: unknown = null;
function runOnce(minGapMs = 0): Promise<unknown> {
  if (running) return running;
  if (Date.now() - lastRunAt < minGapMs) return Promise.resolve(lastResult);
  running = runIntegrations(store, runEnv)
    .then((r) => {
      lastResult = r;
      console.log(`${new Date().toISOString()} integrations ${JSON.stringify(r)}`);
      return r;
    })
    .catch((e) => {
      console.log(`${new Date().toISOString()} integrations FAILED ${(e as Error).stack}`);
      return { error: (e as Error).message };
    })
    .finally(() => {
      lastRunAt = Date.now();
      running = null;
    });
  return running;
}

const handler = createHandler(store, { token: TOKEN, version: __VERSION__, startedAt: Date.now(), runIntegrations: () => runOnce(10_000) });
// Daily backup of the database: data/backups/ember-YYYY-MM-DD.sqlite, the newest 14 are kept.
const BACKUP_DIR = join(DATA_DIR, 'backups');
function backupDaily(): void {
  try {
    mkdirSync(BACKUP_DIR, { recursive: true });
    const name = `ember-${new Date().toISOString().slice(0, 10)}.sqlite`;
    const existing = readdirSync(BACKUP_DIR).filter((f) => /^ember-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort();
    if (!existing.includes(name)) {
      store.backupTo(join(BACKUP_DIR, name));
      console.log(`${new Date().toISOString()} backup ${name}`);
      existing.push(name);
    }
    for (const old of existing.slice(0, Math.max(0, existing.length - 14))) rmSync(join(BACKUP_DIR, old));
  } catch (e) {
    console.log(`${new Date().toISOString()} backup FAILED ${(e as Error).message}`);
  }
}
setTimeout(backupDaily, 60_000);
setInterval(backupDaily, 6 * 3600_000);

setTimeout(() => runOnce(), 15_000);
setInterval(() => runOnce(), 30 * 60_000);

createServer((req, res) => void handler(req, res)).listen(PORT, '127.0.0.1', () => {
  console.log(`habits-api ${__VERSION__} on 127.0.0.1:${PORT} · data ${DATA_DIR}`);
});
