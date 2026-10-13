import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { alive } from '../db/repo';
import { DEFAULT_PREFS, getSetting, type PetSettings, type Prefs } from '../db/settings';
import type { FoodLog, Habit, Purchase, Vacation } from '../db/types';
import { logicalDay, type Day } from '../core/date';
import { nowMs } from '../core/sandbox';
import { indexLogs, type LogIndex } from '../core/habits/schedule';
import { itemsForDay, type ItemContext, type NutritionDay, type NutritionGoals } from '../core/game/items';
import { replay, type GameState } from '../core/game/engine';

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

function summarize(logs: FoodLog[]): Map<Day, NutritionDay> {
  const out = new Map<Day, NutritionDay & { mealSet: Set<string> }>();
  for (const l of logs) {
    let d = out.get(l.day);
    if (!d) out.set(l.day, (d = { kcal: 0, protein: 0, meals: 0, mealSet: new Set() }));
    d.kcal += l.nutrients.kcal;
    d.protein += l.nutrients.protein;
    d.mealSet.add(l.meal);
    d.meals = d.mealSet.size;
  }
  return out;
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
    const habits = alive(data.habits).sort((a, b) => a.order - b.order);
    const logs = indexLogs(data.logs);
    const nutrition = summarize(alive(data.foodLogs));
    const nutritionFor = (day: Day): NutritionDay => nutrition.get(day) ?? { kcal: 0, protein: 0, meals: 0 };
    const itemCtx: ItemContext = { habits, logs, nutritionGoals: data.goals, nutritionFor };
    const purchases = alive(data.purchases);
    const vacations = alive(data.vacations);
    const game = data.pet
      ? replay({
          startDay: data.pet.startDay <= today ? data.pet.startDay : today,
          today,
          itemsFor: (d) => itemsForDay(d, itemCtx),
          purchases,
          vacations,
        })
      : null;
    return {
      now,
      today,
      prefs,
      pet: data.pet,
      habits,
      logs,
      purchases,
      vacations,
      nutritionGoals: data.goals,
      nutritionFor,
      itemCtx,
      game,
    };
  }, [data, now]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

/** null while the database is loading. */
export function useGame(): GameData | null {
  return useContext(GameContext);
}
