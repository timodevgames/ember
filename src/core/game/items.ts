import type { Day } from '../date';
import type { Habit } from '../../db/types';
import { dueInfo, progressOf, valueOn, type LogIndex } from '../habits/schedule';
import { RULES, type Rules } from './rules';

/** One thing that can be done on a day — a habit or a nutrition goal. */
export interface DayItem {
  key: string;
  label: string;
  icon: string;
  kind: 'habit' | 'nutrition';
  /** due → counts toward the score · bonus → XP only · open → may still be done (per-week). */
  state: 'due' | 'bonus' | 'open';
  weight: number;
  xp: number;
  /** 0..1 */
  progress: number;
  habitId?: string;
}

export interface NutritionDay {
  kcal: number;
  protein: number;
  meals: number;
}

export interface NutritionGoals {
  /** First day nutrition goals count — earlier days are never re-scored. */
  since: Day;
  protein: number;
  kcal: number;
  countCalories: boolean;
}

export interface ItemContext {
  habits: Habit[];
  logs: LogIndex;
  nutritionGoals?: NutritionGoals | null;
  nutritionFor?: (day: Day) => NutritionDay;
  rules?: Rules;
}

export function itemsForDay(day: Day, ctx: ItemContext): DayItem[] {
  const rules = ctx.rules ?? RULES;
  const out: DayItem[] = [];
  for (const h of ctx.habits) {
    const info = dueInfo(h, day, ctx.logs);
    if (info.state === 'off' || info.state === 'inactive') continue;
    out.push({
      key: `habit:${h.id}`,
      label: h.name,
      icon: h.icon,
      kind: 'habit',
      state: info.state,
      weight: rules.difficultyWeight[h.difficulty],
      xp: rules.xp[h.difficulty],
      progress: progressOf(h, valueOn(ctx.logs, h.id, day)),
      habitId: h.id,
    });
  }
  const g = ctx.nutritionGoals;
  if (g && day >= g.since && ctx.nutritionFor) {
    const n = ctx.nutritionFor(day);
    const ratio = (v: number, target: number) => (target > 0 ? Math.min(1, v / target) : 0);
    out.push({
      key: 'nutrition:protein',
      label: 'Protein goal',
      icon: '🥩',
      kind: 'nutrition',
      state: 'due',
      weight: rules.difficultyWeight.medium,
      xp: rules.xp.medium,
      progress: ratio(n.protein, g.protein * rules.nutrition.proteinMin),
    });
    out.push({
      key: 'nutrition:meals',
      label: `Log ${rules.nutrition.mealsMin}+ meals`,
      icon: '🍽️',
      kind: 'nutrition',
      state: 'due',
      weight: rules.difficultyWeight.easy,
      xp: rules.xp.easy,
      progress: ratio(n.meals, rules.nutrition.mealsMin),
    });
    if (g.countCalories) {
      out.push({
        key: 'nutrition:kcal',
        label: 'Eat enough calories',
        icon: '🔥',
        kind: 'nutrition',
        state: 'due',
        weight: rules.difficultyWeight.easy,
        xp: rules.xp.easy,
        progress: ratio(n.kcal, g.kcal * rules.nutrition.caloriesMin),
      });
    }
  }
  return out;
}

/** Weighted share of due items done; null when nothing is due (a rest day). */
export function dayScore(items: DayItem[]): number | null {
  let total = 0;
  let done = 0;
  for (const it of items) {
    if (it.state !== 'due') continue;
    total += it.weight;
    done += it.weight * it.progress;
  }
  return total > 0 ? done / total : null;
}
