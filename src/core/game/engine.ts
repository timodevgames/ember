import { addDays, type Day } from '../date';
import type { Purchase, Vacation } from '../../db/types';
import { dayScore, type DayItem } from './items';
import { hpDelta, RULES, stageIndexFor, type FindDef, type Rules } from './rules';

/**
 * The whole game is a pure fold over days. Nothing here is stored: HP, XP,
 * coins, streaks and evolution are recomputed from the logs every time, so two
 * synced devices can never disagree and rule tweaks re-score history.
 *
 * Past days are *settled* (HP, streak, freezes). Today only credits XP/coins
 * immediately — its HP outcome is shown as a projection until the day ends.
 */

export type GameEvent =
  | { type: 'evolved'; stage: number }
  | { type: 'ranAway' }
  | { type: 'rescued'; stage: number }
  | { type: 'freezeEarned' }
  | { type: 'freezeUsed' }
  | { type: 'find'; find: FindDef };

export interface DayResult {
  day: Day;
  kind: 'scored' | 'rest' | 'vacation' | 'today';
  score: number | null;
  xp: number;
  coins: number;
  hpAfter: number;
  hpChange: number;
  frozen: boolean;
  perfect: boolean;
  away: boolean;
  events: GameEvent[];
}

export interface TodayInfo {
  day: Day;
  score: number | null;
  due: number;
  done: number;
  xp: number;
  coins: number;
  perfect: boolean;
  /** What happens to HP if the day ended now. */
  projectedHpChange: number;
  wouldUseFreeze: boolean;
  /** Score needed to avoid losing HP (null when already safe). */
  safeAt: number | null;
  rescueProgressIfEndedNow: number;
}

export interface GameState {
  hp: number;
  bondXp: number;
  stage: number;
  coins: number;
  freezes: number;
  /** Settled streak (up to yesterday). */
  streak: number;
  /** Streak including today if today already reaches the streak threshold. */
  displayStreak: number;
  bestStreak: number;
  away: boolean;
  rescueProgress: number;
  rescues: number;
  perfectDays: number;
  completions: number;
  inventory: Record<string, number>;
  history: DayResult[];
  today: TodayInfo;
}

export interface GameInput {
  startDay: Day;
  today: Day;
  itemsFor: (day: Day) => DayItem[];
  purchases?: Purchase[];
  vacations?: Vacation[];
  rules?: Rules;
}

/** Deterministic per-day random number in [0, 1) — replays must be stable. */
export function dayRandom(day: Day, salt = ''): number {
  let h = 2166136261;
  const s = day + salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

export function pickFind(day: Day, rules: Rules = RULES): FindDef {
  const total = rules.finds.reduce((a, f) => a + f.weight, 0);
  let r = dayRandom(day, 'find') * total;
  for (const f of rules.finds) {
    if ((r -= f.weight) < 0) return f;
  }
  return rules.finds[0];
}

function onVacation(day: Day, vacations: Vacation[]): boolean {
  return vacations.some((v) => !v.deleted && v.from <= day && day <= v.to);
}

export function replay(input: GameInput): GameState {
  const rules = input.rules ?? RULES;
  const vacations = input.vacations ?? [];
  const purchasesByDay = new Map<Day, Purchase[]>();
  for (const p of input.purchases ?? []) {
    if (p.deleted) continue;
    const list = purchasesByDay.get(p.day) ?? [];
    list.push(p);
    purchasesByDay.set(p.day, list);
  }

  const s = {
    hp: rules.hp.start,
    bondXp: 0,
    coins: 0,
    freezes: 0,
    streak: 0,
    bestStreak: 0,
    away: false,
    rescueProgress: 0,
    rescues: 0,
    perfectDays: 0,
    completions: 0,
    inventory: {} as Record<string, number>,
  };
  const history: DayResult[] = [];
  let todayInfo: TodayInfo | null = null;

  for (let day = input.startDay; day <= input.today; day = addDays(day, 1)) {
    const isToday = day === input.today;
    const events: GameEvent[] = [];
    const stageBefore = stageIndexFor(s.bondXp, rules);

    // Purchases happen at the start of their day.
    for (const p of purchasesByDay.get(day) ?? []) {
      s.coins -= p.cost;
      if (p.itemId === 'freeze') s.freezes = Math.min(rules.freeze.maxHeld, s.freezes + 1);
    }

    const items = input.itemsFor(day);
    const due = items.filter((i) => i.state === 'due');
    const completed = items.filter((i) => i.state !== 'open' && i.progress >= 1);
    const score = dayScore(items);
    const perfect = score !== null && score >= 1;
    let xp = completed.reduce((a, i) => a + i.xp, 0);
    let coins = Math.round(xp * rules.coinRatio);
    if (perfect) {
      xp += rules.perfectDay.xp;
      coins += rules.perfectDay.coins;
      const find = pickFind(day, rules);
      if (find.coins) coins += find.coins;
      else s.inventory[find.id] = (s.inventory[find.id] ?? 0) + 1;
      events.push({ type: 'find', find });
      s.perfectDays++;
    }
    s.completions += completed.filter((i) => i.kind === 'habit').length;
    s.coins += coins;
    // The pet only bonds while it is home.
    if (!s.away) s.bondXp += xp;

    const vacation = onVacation(day, vacations);
    const hpBefore = s.hp;
    let frozen = false;
    let kind: DayResult['kind'];

    if (isToday) {
      kind = 'today';
    } else if (vacation) {
      kind = 'vacation';
    } else if (score === null) {
      kind = 'rest';
    } else {
      kind = 'scored';
      if (s.away) {
        s.rescueProgress = score >= rules.rescue.minScore ? s.rescueProgress + 1 : 0;
        if (s.rescueProgress >= rules.rescue.days) {
          const st = stageIndexFor(s.bondXp, rules);
          const lower = Math.max(0, st - 1);
          const from = rules.stages[lower].xp;
          const to = rules.stages[lower + 1]?.xp ?? from;
          s.bondXp = Math.round(from + (to - from) * rules.rescue.xpPosition);
          s.away = false;
          s.hp = rules.rescue.returnHp;
          s.rescueProgress = 0;
          s.rescues++;
          events.push({ type: 'rescued', stage: stageIndexFor(s.bondXp, rules) });
        }
      } else if (score < rules.freeze.protectBelow && s.freezes > 0) {
        s.freezes--;
        frozen = true;
        events.push({ type: 'freezeUsed' });
      } else {
        const grace = rules.firstDayGrace && day === input.startDay;
        const delta = grace ? Math.max(0, hpDelta(score, rules)) : hpDelta(score, rules);
        s.hp = Math.max(0, Math.min(rules.hp.max, s.hp + delta));
      }

      if (score >= rules.streakMinScore) {
        s.streak++;
        s.bestStreak = Math.max(s.bestStreak, s.streak);
        if (s.streak % rules.freeze.earnEvery === 0 && s.freezes < rules.freeze.maxHeld) {
          s.freezes++;
          events.push({ type: 'freezeEarned' });
        }
      } else if (!frozen) {
        s.streak = 0;
      }

      if (!s.away && s.hp <= 0) {
        s.hp = 0;
        s.away = true;
        s.rescueProgress = 0;
        events.push({ type: 'ranAway' });
      }
    }

    const stageAfter = stageIndexFor(s.bondXp, rules);
    if (stageAfter > stageBefore) events.push({ type: 'evolved', stage: stageAfter });

    history.push({
      day,
      kind,
      score,
      xp,
      coins,
      hpAfter: s.hp,
      hpChange: s.hp - hpBefore,
      frozen,
      perfect,
      away: s.away,
      events,
    });

    if (isToday) {
      const sc = score ?? 1;
      let projected = 0;
      let wouldUseFreeze = false;
      let safeAt: number | null = null;
      const grace = rules.firstDayGrace && day === input.startDay;
      if (!vacation && score !== null && !s.away) {
        const delta = grace ? Math.max(0, hpDelta(sc, rules)) : hpDelta(sc, rules);
        if (delta < 0 && sc < rules.freeze.protectBelow && s.freezes > 0) wouldUseFreeze = true;
        else projected = Math.max(-s.hp, Math.min(rules.hp.max - s.hp, delta));
        if (delta < 0) {
          // The lowest score band that doesn't cost HP.
          safeAt = [...rules.hp.bands].reverse().find((b) => b.delta >= 0)?.min ?? null;
        }
      }
      todayInfo = {
        day,
        score,
        due: due.length,
        done: due.filter((i) => i.progress >= 1).length,
        xp,
        coins,
        perfect,
        projectedHpChange: projected,
        wouldUseFreeze,
        safeAt,
        rescueProgressIfEndedNow:
          s.away && score !== null && score >= rules.rescue.minScore ? s.rescueProgress + 1 : s.rescueProgress,
      };
    }
  }

  const today = history[history.length - 1];
  const todayCounts = today?.kind === 'today' && today.score !== null && today.score >= rules.streakMinScore;

  return {
    ...s,
    stage: stageIndexFor(s.bondXp, rules),
    displayStreak: s.streak + (todayCounts ? 1 : 0),
    history,
    today: todayInfo ?? {
      day: input.today,
      score: null,
      due: 0,
      done: 0,
      xp: 0,
      coins: 0,
      perfect: false,
      projectedHpChange: 0,
      wouldUseFreeze: false,
      safeAt: null,
      rescueProgressIfEndedNow: 0,
    },
  };
}
