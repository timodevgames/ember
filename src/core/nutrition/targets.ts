import { addDays, daysBetween, type Day } from '../date';

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very';
export type Goal = 'build' | 'maintain' | 'lose';

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
}

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Recommended protein range in g (shown next to the target). */
  proteinRange: [number, number];
  bmr: number;
  tdee: number;
}

export const ACTIVITY: Record<Activity, { factor: number; label: string; hint: string }> = {
  sedentary: { factor: 1.2, label: 'Mostly sitting', hint: 'School/desk, little sport' },
  light: { factor: 1.375, label: 'Light', hint: 'Sport 1–2× a week' },
  moderate: { factor: 1.55, label: 'Moderate', hint: 'Sport 3–4× a week' },
  active: { factor: 1.725, label: 'Active', hint: 'Sport 5–6× a week' },
  very: { factor: 1.9, label: 'Very active', hint: 'Daily hard training' },
};

export const GOALS: Record<Goal, { label: string; kcalDelta: number; proteinPerKg: number; range: [number, number] }> = {
  build: { label: 'Build muscle', kcalDelta: 250, proteinPerKg: 1.8, range: [1.6, 2.2] },
  maintain: { label: 'Maintain / eat better', kcalDelta: 0, proteinPerKg: 1.6, range: [1.4, 2.0] },
  lose: { label: 'Lose some fat', kcalDelta: -300, proteinPerKg: 2.0, range: [1.8, 2.2] },
};

/** Mifflin–St Jeor resting energy expenditure (kcal/day). */
export function bmr(p: Pick<Profile, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

export function computeTargets(p: Profile): Targets {
  const b = bmr(p);
  const tdee = b * ACTIVITY[p.activity].factor;
  const g = GOALS[p.goal];
  // Never plan below resting needs + 10 % — growing bodies need fuel.
  const kcal = Math.round(Math.max(tdee + g.kcalDelta, b * 1.1) / 10) * 10;
  const protein = Math.round(p.weightKg * g.proteinPerKg);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return {
    kcal,
    protein,
    carbs,
    fat,
    proteinRange: [Math.round(p.weightKg * g.range[0]), Math.round(p.weightKg * g.range[1])],
    bmr: Math.round(b),
    tdee: Math.round(tdee),
  };
}

export interface WeightPoint {
  day: Day;
  kg: number;
}

/** 7-day moving average per logged day (smooths water-weight noise). */
export function weightTrend(points: WeightPoint[]): WeightPoint[] {
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  return sorted.map((p) => {
    const from = addDays(p.day, -6);
    const win = sorted.filter((q) => q.day >= from && q.day <= p.day);
    return { day: p.day, kg: Math.round((win.reduce((a, q) => a + q.kg, 0) / win.length) * 100) / 100 };
  });
}

export interface TrendAdvice {
  weeklyChange: number;
  /** Suggested change to the calorie target, 0 when on track. */
  kcalAdjust: number;
  message: string;
}

/** Needs ≥ 2 weeks of data. Lean bulk sweet spot: +0.1 … +0.5 kg per week. */
export function trendAdvice(points: WeightPoint[], goal: Goal): TrendAdvice | null {
  if (points.length === 0) return null;
  // Only the last 4 weeks matter — a bulk from months ago says nothing about today.
  const lastDay = points.reduce((m, p) => (p.day > m ? p.day : m), points[0].day);
  const t = weightTrend(points).filter((p) => p.day >= addDays(lastDay, -27));
  if (t.length < 4) return null;
  const first = t[0];
  const last = t[t.length - 1];
  const days = daysBetween(first.day, last.day);
  if (days < 14) return null;
  const weekly = Math.round(((last.kg - first.kg) / days) * 7 * 100) / 100;
  const band: Record<Goal, [number, number]> = { build: [0.1, 0.5], maintain: [-0.2, 0.2], lose: [-0.7, -0.2] };
  const [lo, hi] = band[goal];
  if (weekly < lo) return { weeklyChange: weekly, kcalAdjust: 100, message: `You're changing ${fmtKg(weekly)}/week — a little below plan. Try +100 kcal.` };
  if (weekly > hi) return { weeklyChange: weekly, kcalAdjust: -100, message: `You're changing ${fmtKg(weekly)}/week — faster than needed. Try −100 kcal.` };
  return { weeklyChange: weekly, kcalAdjust: 0, message: `${fmtKg(weekly)}/week — right on track.` };
}

function fmtKg(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(2)} kg`;
}
