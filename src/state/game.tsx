import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { DEFAULT_PREFS, getSetting, type PetSettings, type Prefs } from '../db/settings';
import type { Habit, Purchase, Vacation } from '../db/types';
import { logicalDay, type Day } from '../core/date';
import { nowMs } from '../core/sandbox';
import type { LogIndex } from '../core/habits/schedule';
import type { ItemContext, NutritionDay, NutritionGoals } from '../core/game/items';
import type { GameState } from '../core/game/engine';
import { computeGame } from '../core/game/state';

export interface GameData {
  now: number;
  today: Day;
  prefs: Prefs;
  pet: PetSettings | null;
  habits: Habit[];
  logs: LogIndex;
  purchases: Purchase[];
  vacations: Vacation[];
  nutritionGoals: NutritionGoals | null;
  nutritionFor: (day: Day) => NutritionDay;
  itemCtx: ItemContext;
  game: GameState | null;
  /** `${habitId}:${day}` where an auto-check (Music Coach, Valorant, GD) logged progress. */
  autoSet: Set<string>;
  worn: { hat?: string; bg?: string };
}

const GameContext = createContext<GameData | null>(null);

/** Re-render once a minute (and when the tab becomes visible) so the day rolls over. */
function useNow(): number {
  const [now, setNow] = useState(nowMs);
  useEffect(() => {
    const tick = () => setNow(nowMs());
    const id = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return now;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const now = useNow();
  const data = useLiveQuery(async () => {
    const [habits, logs, purchases, vacations, foodLogs, pet, prefs, goals] = await Promise.all([
      db.habits.toArray(),
      db.habitLogs.toArray(),
      db.purchases.toArray(),
      db.vacations.toArray(),
      db.foodLogs.toArray(),
      getSetting<PetSettings | null>('pet', null),
      getSetting<Prefs>('prefs', DEFAULT_PREFS),
      getSetting<NutritionGoals | null>('nutritionGoals', null),
    ]);
    return { habits, logs, purchases, vacations, foodLogs, pet, prefs, goals };
  });

  const value = useMemo<GameData | null>(() => {
    if (!data) return null;
    const prefs = { ...DEFAULT_PREFS, ...data.prefs };
    const today = logicalDay(now, prefs.dayStartHour);
    const c = computeGame(
      { habits: data.habits, habitLogs: data.logs, purchases: data.purchases, vacations: data.vacations, foodLogs: data.foodLogs, pet: data.pet, goals: data.goals },
      today,
    );
    return { now, today, prefs, pet: data.pet, nutritionGoals: data.goals, ...c };
  }, [data, now]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

/** null while the database is loading. */
export function useGame(): GameData | null {
  return useContext(GameContext);
}
