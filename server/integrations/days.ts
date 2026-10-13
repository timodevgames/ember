import { addDays, type Day } from '../../src/core/date';

/** Logical day of `ts` in an IANA time zone (the phone's own TZ is irrelevant). */
export function logicalDayTz(ts: number, timeZone: string, dayStartHour = 4): Day {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ts));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const day = `${get('year')}-${get('month')}-${get('day')}`;
  return Number(get('hour')) < dayStartHour ? addDays(day, -1) : day;
}
