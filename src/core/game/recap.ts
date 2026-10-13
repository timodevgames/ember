import { addDays, dayRange, type Day } from '../date';
import type { Habit, IntegrationStat, WeightEntry } from '../../db/types';
import { dueInfo, progressOf, valueOn, type LogIndex } from '../habits/schedule';
import type { GdStat, MusicCoachStat, ValorantStat } from '../integrations/types';
import type { GameState } from './engine';
import type { NutritionDay, NutritionGoals } from './items';
import { RULES } from './rules';

/** Everything the weekly recap screen shows, for one Monday–Sunday week. */
export interface WeekRecap {
  weekStart: Day;
  weekEnd: Day;
  /** Days of the week that are already over (and after the pet arrived). */
  days: number;
  avgScore: number | null;
  perfectDays: number;
  xp: number;
  coins: number;
  hpStart: number;
  hpEnd: number;
  freezesUsed: number;
  evolved: number[];
  ranAway: boolean;
  rescued: boolean;
  finds: string[];
  habits: { id: string; name: string; icon: string; done: number; due: number; rate: number }[];
  nutrition: { proteinDays: number; trackedDays: number; avgProtein: number; avgKcal: number } | null;
  weight: { start: number; end: number } | null;
  valorant: { matches: number; hours: number; rankStart?: string; rankEnd?: string } | null;
  gd: Partial<Record<keyof GdStat, number>> | null;
  musicMinutes: number | null;
}

export interface RecapInput {
  weekStart: Day;
  today: Day;
  game: GameState;
  habits: Habit[];
  logs: LogIndex;
  nutritionFor: (day: Day) => NutritionDay;
  goals: NutritionGoals | null;
  weights: WeightEntry[];
  stats: IntegrationStat[];
}

export function weekRecap(input: RecapInput): WeekRecap {
  const { weekStart, today, game } = input;
  const weekEnd = addDays(weekStart, 6);
  const lastDay = weekEnd < today ? weekEnd : addDays(today, -1); // only finished days
  const days = lastDay >= weekStart ? dayRange(weekStart, lastDay) : [];
  const byDay = new Map(game.history.map((h) => [h.day, h]));
  const hist = days.map((d) => byDay.get(d)).filter((h): h is NonNullable<typeof h> => !!h);

  const scored = hist.filter((h) => h.kind === 'scored' && h.score !== null);
  const before = byDay.get(addDays(weekStart, -1));
  const events = hist.flatMap((h) => h.events);

  const habits = input.habits
    .map((h) => {
      let due = 0;
      let done = 0;
      for (const d of days) {
        if (dueInfo(h, d, input.logs).state !== 'due') continue;
        due++;
        if (progressOf(h, valueOn(input.logs, h.id, d)) >= 1) done++;
      }
      return { id: h.id, name: h.name, icon: h.icon, done, due, rate: due ? done / due : 0 };
    })
    .filter((h) => h.due > 0)
    .sort((a, b) => b.rate - a.rate || b.done - a.done);

  let nutrition: WeekRecap['nutrition'] = null;
  if (input.goals) {
    const tracked = days.filter((d) => d >= input.goals!.since).map(input.nutritionFor).filter((n) => n.meals > 0);
    if (tracked.length) {
      nutrition = {
        trackedDays: tracked.length,
        proteinDays: tracked.filter((n) => n.protein >= input.goals!.protein * RULES.nutrition.proteinMin).length,
        avgProtein: Math.round(tracked.reduce((a, n) => a + n.protein, 0) / tracked.length),
        avgKcal: Math.round(tracked.reduce((a, n) => a + n.kcal, 0) / tracked.length),
      };
    }
  }

  const w = input.weights.filter((x) => !x.deleted && x.day >= weekStart && x.day <= weekEnd).sort((a, b) => a.day.localeCompare(b.day));
  const weight = w.length >= 2 ? { start: w[0].kg, end: w[w.length - 1].kg } : null;

  const stats = input.stats.filter((s) => !s.deleted && s.id.startsWith('stat:'));
  const inWeek = (s: IntegrationStat) => s.day >= weekStart && s.day <= weekEnd;
  const val = stats.filter((s) => s.source === 'valorant' && inWeek(s)).sort((a, b) => a.day.localeCompare(b.day));
  const valorant = val.length
    ? {
        matches: val.reduce((a, s) => a + ((s.data as unknown as ValorantStat).matches ?? 0), 0),
        hours: Math.round(val.reduce((a, s) => a + ((s.data as unknown as ValorantStat).minutes ?? 0), 0) / 6) / 10,
        rankStart: val.map((s) => (s.data as unknown as ValorantStat).tier).find(Boolean),
        rankEnd: [...val].reverse().map((s) => (s.data as unknown as ValorantStat).tier).find(Boolean),
      }
    : null;

  const gdRows = stats.filter((s) => s.source === 'geometryDash').sort((a, b) => a.day.localeCompare(b.day));
  const gdEnd = [...gdRows].reverse().find((s) => s.day <= weekEnd);
  const gdStart = [...gdRows].reverse().find((s) => s.day < weekStart);
  let gd: WeekRecap['gd'] = null;
  if (gdEnd && gdStart && gdEnd !== gdStart) {
    const a = gdStart.data as unknown as GdStat;
    const b = gdEnd.data as unknown as GdStat;
    gd = {};
    for (const k of Object.keys(b) as (keyof GdStat)[]) if (b[k] - (a[k] ?? 0) > 0) gd[k] = b[k] - (a[k] ?? 0);
  }

  const mc = stats.filter((s) => s.source === 'musicCoach' && inWeek(s));
  const musicMinutes = mc.length ? mc.reduce((a, s) => a + ((s.data as unknown as MusicCoachStat).minutes ?? 0), 0) : null;

  return {
    weekStart,
    weekEnd,
    days: hist.length,
    avgScore: scored.length ? scored.reduce((a, h) => a + (h.score ?? 0), 0) / scored.length : null,
    perfectDays: hist.filter((h) => h.perfect).length,
    xp: hist.reduce((a, h) => a + h.xp, 0),
    coins: hist.reduce((a, h) => a + h.coins, 0),
    hpStart: before?.hpAfter ?? RULES.hp.start,
    hpEnd: hist.length ? hist[hist.length - 1].hpAfter : (before?.hpAfter ?? RULES.hp.start),
    freezesUsed: hist.filter((h) => h.frozen).length,
    evolved: events.flatMap((e) => (e.type === 'evolved' ? [e.stage] : [])),
    ranAway: events.some((e) => e.type === 'ranAway'),
    rescued: events.some((e) => e.type === 'rescued'),
    finds: events.flatMap((e) => (e.type === 'find' && !e.find.coins ? [e.find.icon] : [])),
    habits,
    nutrition,
    weight,
    valorant,
    gd,
    musicMinutes,
  };
}

export function recapVerdict(avg: number | null, name: string): string {
  if (avg === null) return `A quiet week — nothing was due.`;
  if (avg >= 0.9) return `A legendary week. ${name} is glowing.`;
  if (avg >= 0.75) return `A strong week — ${name} is proud of you.`;
  if (avg >= 0.5) return `An okay week. A little more next week and ${name} will thrive.`;
  return `A rough week — ${name} needs you. Pick one habit and nail it tomorrow.`;
}
