import { DatabaseSync } from 'node:sqlite';
import { SYNCED_TABLES, type SyncedTable } from '../src/db/types';
import type { Change, SyncRecord } from '../src/core/sync/protocol';

const TABLES = new Set<string>(SYNCED_TABLES);

/**
 * One row per (table, id), last write wins on `updatedAt`. Every accepted write
 * gets a new, strictly increasing `seq`; clients pull "everything after seq N".
 */
export class Store {
  readonly db: DatabaseSync;

  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS records (
        tbl TEXT NOT NULL,
        id TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        seq INTEGER NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (tbl, id)
      );
      CREATE INDEX IF NOT EXISTS records_seq ON records (seq);
      CREATE TABLE IF NOT EXISTS off_cache (
        code TEXT PRIMARY KEY,
        fetchedAt INTEGER NOT NULL,
        status INTEGER NOT NULL,
        body TEXT NOT NULL
      );
    `);
  }

  /** Applies newer records; returns how many were accepted. Invalid rows are skipped. */
  merge(changes: Change[]): number {
    const get = this.db.prepare('SELECT updatedAt FROM records WHERE tbl = ? AND id = ?');
    const put = this.db.prepare(
      'INSERT INTO records (tbl, id, updatedAt, seq, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT (tbl, id) DO UPDATE SET updatedAt = excluded.updatedAt, seq = excluded.seq, data = excluded.data',
    );
    let applied = 0;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      let seq = (this.db.prepare('SELECT COALESCE(MAX(seq), 0) AS s FROM records').get() as { s: number }).s;
      for (const c of changes) {
        if (!valid(c)) continue;
        const cur = get.get(c.table, c.record.id) as { updatedAt: number } | undefined;
        if (cur && cur.updatedAt >= c.record.updatedAt) continue;
        put.run(c.table, c.record.id, c.record.updatedAt, ++seq, JSON.stringify(c.record));
        applied++;
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    return applied;
  }

  since(cursor: number, limit = 2000): { changes: Change[]; cursor: number; more: boolean } {
    const rows = this.db
      .prepare('SELECT tbl, data, seq FROM records WHERE seq > ? ORDER BY seq LIMIT ?')
      .all(cursor, limit + 1) as { tbl: string; data: string; seq: number }[];
    const more = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      changes: page.map((r) => ({ table: r.tbl as SyncedTable, record: JSON.parse(r.data) as SyncRecord })),
      cursor: page.length ? page[page.length - 1].seq : cursor,
      more,
    };
  }

  get(table: SyncedTable, id: string): SyncRecord | undefined {
    const r = this.db.prepare('SELECT data FROM records WHERE tbl = ? AND id = ?').get(table, id) as { data: string } | undefined;
    return r ? (JSON.parse(r.data) as SyncRecord) : undefined;
  }

  all(table: SyncedTable): SyncRecord[] {
    return (this.db.prepare('SELECT data FROM records WHERE tbl = ?').all(table) as { data: string }[]).map((r) => JSON.parse(r.data) as SyncRecord);
  }

  offGet(code: string): { fetchedAt: number; status: number; body: string } | undefined {
    return this.db.prepare('SELECT fetchedAt, status, body FROM off_cache WHERE code = ?').get(code) as
      | { fetchedAt: number; status: number; body: string }
      | undefined;
  }

  offPut(code: string, status: number, body: string): void {
    this.db
      .prepare('INSERT INTO off_cache (code, fetchedAt, status, body) VALUES (?, ?, ?, ?) ON CONFLICT (code) DO UPDATE SET fetchedAt = excluded.fetchedAt, status = excluded.status, body = excluded.body')
      .run(code, Date.now(), status, body);
  }

  /** Consistent snapshot of the whole database (safe while the server is running). */
  backupTo(file: string): void {
    this.db.prepare('VACUUM INTO ?').run(file);
  }

  stats(): Record<string, number> {
    const rows = this.db.prepare('SELECT tbl, COUNT(*) AS n FROM records GROUP BY tbl').all() as { tbl: string; n: number }[];
    return Object.fromEntries(rows.map((r) => [r.tbl, r.n]));
  }
}

function valid(c: Change): boolean {
  const r = c?.record;
  return (
    TABLES.has(c?.table) &&
    !!r &&
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    r.id.length <= 200 &&
    typeof r.updatedAt === 'number' &&
    Number.isFinite(r.updatedAt)
  );
}
