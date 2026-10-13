import { db } from './db';
import type { SyncedTable, SyncFields } from './types';

/**
 * All writes go through here so every record gets sync metadata and the sync
 * client hears about it. `updatedAt` is REAL time (never the sandbox clock):
 * sync merges last-write-wins on it.
 */

const DEVICE_KEY = 'ember.deviceId';
let cachedDeviceId: string | null = null;

export function deviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  let id: string | null = null;
  try {
    id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
  } catch {
    id = 'device-' + Math.random().toString(36).slice(2);
  }
  cachedDeviceId = id;
  return id;
}

export function newId(): string {
  return crypto.randomUUID();
}

type Listener = () => void;
const listeners = new Set<Listener>();
export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) fn();
}

export type Draft<T extends SyncFields> = Omit<T, 'updatedAt' | 'deviceId' | 'id'> & { id?: string };

export async function save<T extends SyncFields>(table: SyncedTable, rec: Draft<T>): Promise<T> {
  const full = { ...rec, id: rec.id ?? newId(), updatedAt: Date.now(), deviceId: deviceId(), deleted: 0 } as unknown as T;
  await db.table(table).put(full);
  emit();
  return full;
}

export async function saveMany<T extends SyncFields>(table: SyncedTable, recs: Draft<T>[]): Promise<void> {
  const now = Date.now();
  const rows = recs.map((r) => ({ ...r, id: r.id ?? newId(), updatedAt: now, deviceId: deviceId(), deleted: 0 }));
  await db.table(table).bulkPut(rows);
  emit();
}

/** Soft delete (tombstone) so the deletion syncs to other devices. */
export async function remove(table: SyncedTable, id: string): Promise<void> {
  const row = await db.table(table).get(id);
  if (!row) return;
  await db.table(table).put({ ...row, deleted: 1, updatedAt: Date.now(), deviceId: deviceId() });
  emit();
}

export function alive<T extends { deleted?: 0 | 1 }>(rows: T[] | undefined): T[] {
  return (rows ?? []).filter((r) => !r.deleted);
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
