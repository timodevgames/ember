#!/usr/bin/env node
/**
 * habits-api — Ember's sync server on the Pixel (pm2, port 3040, behind the
 * edge-proxy at /habits). Zero runtime dependencies: node:http + node:sqlite.
 *
 *   PORT=3040 SYNC_TOKEN=… DATA_DIR=./data node index.mjs
 *   (pm2 passes --env-file=.env)
 */
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store';
import { createHandler } from './app';

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
const handler = createHandler(store, { token: TOKEN, version: __VERSION__, startedAt: Date.now() });

createServer((req, res) => void handler(req, res)).listen(PORT, '127.0.0.1', () => {
  console.log(`habits-api ${__VERSION__} on 127.0.0.1:${PORT} · data ${DATA_DIR}`);
});
