import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { save } from './repo';
import type { SettingRow } from './types';

export { DEFAULT_PREFS, type PetSettings, type Prefs } from './types';

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row && !row.deleted ? (row.value as T) : fallback;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await save<SettingRow>('settings', { id: key, value });
}

/** Live setting; `undefined` while loading. */
export function useSetting<T>(key: string, fallback: T): T | undefined {
  return useLiveQuery(async () => getSetting(key, fallback), [key]);
}
