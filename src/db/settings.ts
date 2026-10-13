import { useLiveQuery } from 'dexie-react-hooks';
import type { Day } from '../core/date';
import type { PetColor } from '../core/game/pet';
import { db } from './db';
import { save } from './repo';
import type { SettingRow } from './types';

export interface PetSettings {
  name: string;
  color: PetColor;
  /** The day the egg arrived — the game replays from here. */
  startDay: Day;
}

export interface Prefs {
  dayStartHour: number;
}

export const DEFAULT_PREFS: Prefs = { dayStartHour: 4 };

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
