import type { Day } from '../core/date';
import type { PetColor } from '../core/game/pet';

/**
 * Every synced record carries these. `updatedAt` is real wall-clock ms (never
 * the sandbox clock) — sync merges last-write-wins on it. `deleted` is a
 * tombstone (0/1 because IndexedDB can't index booleans).
 */
export interface SyncFields {
  id: string;
  updatedAt: number;
  deleted?: 0 | 1;
  deviceId?: string;
}

export type Category = 'music' | 'gaming' | 'body' | 'mind' | 'other';
export type HabitKind = 'check' | 'count' | 'duration';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type AutoSource = 'musicCoach' | 'valorant' | 'geometryDash';
export type LogSource = 'manual' | AutoSource;

export type Schedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] } // 0 = Mon … 6 = Sun
  | { type: 'perWeek'; times: number };

export interface Habit extends SyncFields {
  name: string;
  icon: string;
  category: Category;
  kind: HabitKind;
  /** check → 1; count → e.g. 8 glasses; duration → minutes. */
  target: number;
  unit?: string;
  schedule: Schedule;
  difficulty: Difficulty;
  autoSource?: AutoSource;
  order: number;
  /** First logical day the habit counts. */
  createdDay: Day;
  /** Not due from this day on (history before it is kept). */
  archivedDay?: Day;
}

export interface HabitLog extends SyncFields {
  habitId: string;
  day: Day;
  value: number;
  source: LogSource;
  createdAt: number;
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  salt?: number;
}

export interface Serving {
  label: string;
  grams: number;
}

/** Cached Open Food Facts products (`off:<barcode>`) and custom foods (`custom:<uuid>`). */
export interface Food extends SyncFields {
  source: 'off' | 'custom';
  name: string;
  brand?: string;
  barcode?: string;
  per100: Nutrients;
  servings?: Serving[];
  favorite?: 0 | 1;
}

export interface RecipeItem {
  foodId: string;
  name: string;
  grams: number;
  per100: Nutrients;
}

export interface Recipe extends SyncFields {
  name: string;
  items: RecipeItem[];
  /** How many portions the whole recipe makes. */
  servings: number;
  favorite?: 0 | 1;
}

export interface FoodLog extends SyncFields {
  day: Day;
  meal: Meal;
  foodId: string;
  name: string;
  grams: number;
  /** Snapshot at logging time — editing the food later never rewrites history. */
  nutrients: Nutrients;
  createdAt: number;
}

export interface WeightEntry extends SyncFields {
  day: Day;
  kg: number;
}

export interface Reward extends SyncFields {
  name: string;
  icon: string;
  cost: number;
}

export interface Purchase extends SyncFields {
  /** 'freeze' | `reward:<id>` | `cosmetic:<id>` */
  itemId: string;
  name: string;
  cost: number;
  day: Day;
  createdAt: number;
}

export interface Vacation extends SyncFields {
  from: Day;
  to: Day;
  reason?: string;
}

/** Setting `pet`. */
export interface PetSettings {
  name: string;
  color: PetColor;
  /** The day the egg arrived — the game replays from here. */
  startDay: Day;
  /** Cosmetics bought in the shop and currently worn (ids from cosmetics.ts). */
  equipped?: { hat?: string; bg?: string };
}

/** Setting `prefs`. */
export interface Prefs {
  dayStartHour: number;
}

export const DEFAULT_PREFS: Prefs = { dayStartHour: 4 };

/** Key/value settings, synced per key (id = key). */
export interface SettingRow extends SyncFields {
  value: unknown;
}

/** Written by the server (Valorant rank, GD stats …), read-only on clients. */
export interface IntegrationStat extends SyncFields {
  source: AutoSource;
  day: Day;
  data: Record<string, unknown>;
}

/** Local-only key/value (sync token, cursor, device id, last seen stage …). */
export interface MetaRow {
  key: string;
  value: unknown;
}

export const SYNCED_TABLES = [
  'habits',
  'habitLogs',
  'foods',
  'recipes',
  'foodLogs',
  'weights',
  'rewards',
  'purchases',
  'vacations',
  'settings',
  'integrationStats',
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];
