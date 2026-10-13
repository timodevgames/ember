import { addDays, type Day } from '../src/core/date';
import type { FoodLog, Habit, HabitLog, PetSettings, Prefs, Purchase, Vacation } from '../src/db/types';
import type { IntegrationSettings } from '../src/core/integrations/types';
import type { NutritionGoals } from '../src/core/game/items';
import { itemsForDay } from '../src/core/game/items';
import { computeGame } from '../src/core/game/state';
import type { Store } from './store';
import { logicalDayTz } from './integrations/days';

export type ReminderKind = 'morning' | 'evening';

export interface Reminder {
  title: string;
  body: string;
  tag: string;
}

/** User context the scheduler needs: time zone and day boundary. */
export function userClock(store: Store): { tz: string; startHour: number } {
  const integ = (store.get('settings', 'integrations')?.value ?? {}) as Partial<IntegrationSettings>;
  const prefs = (store.get('settings', 'prefs')?.value ?? {}) as Partial<Prefs>;
  return { tz: integ.timeZone || 'Europe/Berlin', startHour: prefs.dayStartHour ?? 4 };
}

export function localHour(ts: number, tz: string): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date(ts)));
}

function list(labels: string[]): string {
  if (labels.length <= 2) return labels.join(' and ');
  return `${labels.slice(0, 2).join(', ')} and ${labels.length - 2} more`;
}

/**
 * The text of a reminder, computed from the same replay the app runs — so
 * "loses 10 HP tonight" is exactly what the app shows. null = nothing to say.
 */
export function buildReminder(kind: ReminderKind, store: Store, now: number): Reminder | null {
  const setting = <T>(id: string) => (store.get('settings', id)?.value ?? null) as T | null;
  const pet = setting<PetSettings>('pet');
  if (!pet) return null;
  const { tz, startHour } = userClock(store);
  const today: Day = logicalDayTz(now, tz, startHour);
  const all = <T>(t: Parameters<Store['all']>[0]) => store.all(t) as unknown as T[];
  const c = computeGame(
    {
      habits: all<Habit>('habits'),
      habitLogs: all<HabitLog>('habitLogs'),
      purchases: all<Purchase>('purchases'),
      vacations: all<Vacation>('vacations'),
      foodLogs: all<FoodLog>('foodLogs'),
      pet,
      goals: setting<NutritionGoals>('nutritionGoals'),
    },
    today,
  );
  const g = c.game;
  if (!g) return null;
  const onVacation = c.vacations.some((v) => v.from <= today && today <= v.to);
  if (onVacation) return null;

  const due = itemsForDay(today, c.itemCtx).filter((i) => i.state === 'due');
  const left = due.filter((i) => i.progress < 1).map((i) => i.label);
  const title = `${pet.name} 🦊`;
  const tag = `ember-${kind}-${today}`;

  if (kind === 'morning') {
    const ranAway = g.history.find((h) => h.day === addDays(today, -1))?.events.some((e) => e.type === 'ranAway');
    if (ranAway) return { title, body: `🌲 ${pet.name} ran away last night. Three strong days bring it home — start today: ${list(left)}.`, tag };
    if (due.length === 0) return null;
    if (g.away) return { title, body: `🌲 Rescue quest ${g.rescueProgress}/3 — reach 80% today: ${list(left)}.`, tag };
    return { title, body: `☀️ ${due.length} planned today: ${list(due.map((i) => i.label))}. ${pet.name} has ${g.hp} HP.`, tag };
  }

  // evening
  if (g.today.score === null || left.length === 0) return null;
  if (g.away) return { title, body: `🌲 Rescue day ${g.rescueProgress + 1}/3 needs 80% today. Still open: ${list(left)}.`, tag };
  if (g.today.projectedHpChange < 0) {
    return { title, body: `⚠️ ${pet.name} loses ${-g.today.projectedHpChange} HP tonight (${g.hp} HP now). Still open: ${list(left)}.`, tag };
  }
  if (g.today.wouldUseFreeze) return { title, body: `❄️ A streak freeze would cover today — but ${pet.name} would rather see ${list(left)}.`, tag };
  const score = g.today.score ?? 0;
  const tail = score >= 0.8 ? 'You’re safe — finish them for a perfect day ⭐' : 'Reach 80% and HP goes up 💚';
  return { title, body: `${left.length} left today: ${list(left)}. ${tail}`, tag };
}
