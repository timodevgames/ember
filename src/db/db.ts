import Dexie, { type Table } from 'dexie';
import { isSandbox } from '../core/sandbox';
import type {
  Food,
  FoodLog,
  Habit,
  HabitLog,
  IntegrationStat,
  MetaRow,
  Purchase,
  Recipe,
  Reward,
  SettingRow,
  Vacation,
  WeightEntry,
} from './types';

export class EmberDB extends Dexie {
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  foods!: Table<Food, string>;
  recipes!: Table<Recipe, string>;
  foodLogs!: Table<FoodLog, string>;
  weights!: Table<WeightEntry, string>;
  rewards!: Table<Reward, string>;
  purchases!: Table<Purchase, string>;
  vacations!: Table<Vacation, string>;
  settings!: Table<SettingRow, string>;
  integrationStats!: Table<IntegrationStat, string>;
  meta!: Table<MetaRow, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      habits: 'id, updatedAt, order',
      habitLogs: 'id, updatedAt, day, habitId',
      foods: 'id, updatedAt, barcode, source',
      recipes: 'id, updatedAt',
      foodLogs: 'id, updatedAt, day, foodId',
      weights: 'id, updatedAt, day',
      rewards: 'id, updatedAt',
      purchases: 'id, updatedAt, day',
      vacations: 'id, updatedAt',
      settings: 'id, updatedAt',
      integrationStats: 'id, updatedAt, day, source',
      meta: 'key',
    });
  }
}

export const DB_NAME = isSandbox() ? 'ember-sandbox' : 'ember';
export const db = new EmberDB(DB_NAME);
