/**
 * Logical days. A "day" is a local-calendar string `YYYY-MM-DD`, but it starts
 * at `dayStartHour` (default 04:00) instead of midnight — a Valorant game at
 * 01:30 still belongs to the evening before.
 *
 * Day strings are parsed at local NOON so arithmetic never trips over DST
 * switches (Europe/Berlin moves its clocks at 02:00/03:00).
 */
export type Day = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDay(d: Date): Day {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** The logical day a timestamp belongs to. */
export function logicalDay(ts: number, dayStartHour = 4): Day {
  const d = new Date(ts);
  if (d.getHours() < dayStartHour) d.setDate(d.getDate() - 1);
  return formatDay(d);
}

/** Wall-clock timestamp at which `day` ends (= the next day's start hour). */
export function dayEndTs(day: Day, dayStartHour = 4): number {
  const d = parseDay(addDays(day, 1));
  d.setHours(dayStartHour, 0, 0, 0);
  return d.getTime();
}

export function dayStartTs(day: Day, dayStartHour = 4): number {
  const d = parseDay(day);
  d.setHours(dayStartHour, 0, 0, 0);
  return d.getTime();
}

export function addDays(day: Day, n: number): Day {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return formatDay(d);
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: Day, b: Day): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

/** Inclusive list of days from `from` to `to`. Empty when from > to. */
export function dayRange(from: Day, to: Day): Day[] {
  const out: Day[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(day: Day): number {
  return (parseDay(day).getDay() + 6) % 7;
}

/** Monday of the week containing `day`. */
export function weekStart(day: Day): Day {
  return addDays(day, -weekday(day));
}

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function prettyDay(day: Day, today: Day): string {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return parseDay(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
