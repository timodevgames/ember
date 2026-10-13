import { db } from './db';
import { SYNCED_TABLES, type SyncFields } from './types';

export interface Backup {
  app: 'ember';
  version: 1;
  exportedAt: string;
  tables: Record<string, SyncFields[]>;
}

export async function exportBackup(): Promise<Backup> {
  const tables: Record<string, SyncFields[]> = {};
  for (const t of SYNCED_TABLES) tables[t] = await db.table(t).toArray();
  return { app: 'ember', version: 1, exportedAt: new Date().toISOString(), tables };
}

/** Merge a backup in: a row only replaces a local one if it is newer (same rule as sync). */
export async function importBackup(b: Backup): Promise<number> {
  if (b?.app !== 'ember' || !b.tables) throw new Error('Not an Ember backup file');
  let changed = 0;
  await db.transaction('rw', SYNCED_TABLES.map((t) => db.table(t)), async () => {
    for (const t of SYNCED_TABLES) {
      const rows = b.tables[t] ?? [];
      const table = db.table(t);
      for (const row of rows) {
        const cur = (await table.get(row.id)) as SyncFields | undefined;
        if (!cur || cur.updatedAt < row.updatedAt) {
          await table.put(row);
          changed++;
        }
      }
    }
  });
  return changed;
}

export async function downloadBackup(): Promise<void> {
  const data = await exportBackup();
  const name = `ember-backup-${data.exportedAt.slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  // iOS home-screen apps can't "download" — the share sheet saves to Files instead.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
