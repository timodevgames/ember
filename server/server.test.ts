/// <reference types="node" />
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Store } from './store';
import { createHandler } from './app';
import type { Change } from '../src/core/sync/protocol';

const TOKEN = 'test-token-0123456789abcdef';

function rec(id: string, updatedAt: number, extra: Record<string, unknown> = {}): Change {
  return { table: 'habits', record: { id, updatedAt, name: id, ...extra } };
}

describe('store', () => {
  it('merges last-write-wins and pages by seq', () => {
    const s = new Store(':memory:');
    expect(s.merge([rec('a', 10), rec('b', 10)])).toBe(2);
    expect(s.merge([rec('a', 5, { name: 'old' })])).toBe(0); // older loses
    expect(s.merge([rec('a', 10, { name: 'same' })])).toBe(0); // tie keeps existing
    expect(s.merge([rec('a', 20, { name: 'new' })])).toBe(1);
    expect(s.get('habits', 'a')?.name).toBe('new');
    const all = s.since(0);
    expect(all.changes.map((c) => c.record.id)).toEqual(['b', 'a']);
    expect(s.since(all.cursor).changes).toEqual([]);
    const page = s.since(0, 1);
    expect(page.more).toBe(true);
    expect(page.changes).toHaveLength(1);
  });
  it('rejects unknown tables and malformed records', () => {
    const s = new Store(':memory:');
    expect(s.merge([{ table: 'nope' as never, record: { id: 'x', updatedAt: 1 } }, { table: 'habits', record: { id: '', updatedAt: 1 } }, { table: 'habits', record: { id: 'y' } as never }])).toBe(0);
  });
  it('keeps tombstones so deletions sync', () => {
    const s = new Store(':memory:');
    s.merge([rec('a', 1)]);
    s.merge([rec('a', 2, { deleted: 1 })]);
    expect(s.since(0).changes[0].record.deleted).toBe(1);
  });
});

describe('http api', () => {
  let server: Server;
  let base = '';
  const store = new Store(':memory:');
  const offCalls: string[] = [];
  const fakeFetch = (async (url: string) => {
    offCalls.push(url);
    return new Response(JSON.stringify({ status: 'success', product: { code: '20692285', product_name: 'Skyr' } }), { status: 200 });
  }) as unknown as typeof fetch;

  beforeAll(async () => {
    server = createServer(createHandler(store, { token: TOKEN, version: 'test', startedAt: Date.now(), fetchImpl: fakeFetch, log: () => {} }));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  const post = (path: string, body: unknown) =>
    fetch(base + path, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, cors: r.headers.get('access-control-allow-origin'), json: (await r.json()) as Record<string, unknown> }));

  it('health is public', async () => {
    const r = await fetch(base + '/health');
    expect(r.status).toBe(200);
    expect(((await r.json()) as { service: string }).service).toBe('habits-api');
  });

  it('rejects a wrong token', async () => {
    const r = await post('/sync', { token: 'nope', since: 0, changes: [] });
    expect(r.status).toBe(401);
  });

  it('two devices converge through /sync', async () => {
    const a = await post('/sync', { token: TOKEN, deviceId: 'A', since: 0, changes: [rec('h1', 100)] });
    expect(a.json.applied).toBe(1);
    expect(a.cors).toBe('*');
    const b = await post('/sync', { token: TOKEN, deviceId: 'B', since: 0, changes: [rec('h2', 100)] });
    const ids = (b.json.changes as Change[]).map((c) => c.record.id).sort();
    expect(ids).toEqual(['h1', 'h2']);
    const a2 = await post('/sync', { token: TOKEN, deviceId: 'A', since: a.json.cursor, changes: [] });
    expect((a2.json.changes as Change[]).map((c) => c.record.id)).toContain('h2');
  });

  it('proxies Open Food Facts once and then serves the cache', async () => {
    const r1 = await post('/off/product', { token: TOKEN, barcode: '20692285' });
    const r2 = await post('/off/product', { token: TOKEN, barcode: '20692285' });
    expect(r1.json.cached).toBe(false);
    expect(r2.json.cached).toBe(true);
    expect(offCalls).toHaveLength(1);
    expect((r2.json.product as { product: { product_name: string } }).product.product_name).toBe('Skyr');
  });
});

describe('backup', () => {
  it('writes a consistent copy that opens as a database', async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const s = new Store(':memory:');
    s.merge([rec('a', 1)]);
    const file = join(mkdtempSync(join(tmpdir(), 'ember-bk-')), 'copy.sqlite');
    s.backupTo(file);
    expect(new Store(file).get('habits', 'a')?.name).toBe('a');
  });
});
