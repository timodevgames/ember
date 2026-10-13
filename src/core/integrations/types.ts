import type { AutoSource } from '../../db/types';

/** Synced setting `integrations` — written by the app, read by habits-api. */
export interface IntegrationSettings {
  /** IANA zone of the user's devices; the server computes logical days in it. */
  timeZone: string;
  riot?: { name: string; tag: string; region: ValorantRegion };
  gdUsername?: string;
  /** Which Music Coach instance on the Pixel holds Timo's sessions. */
  musicCoachPort?: number;
}

export type ValorantRegion = 'eu' | 'na' | 'ap' | 'kr' | 'latam' | 'br';
export const VALORANT_REGIONS: ValorantRegion[] = ['eu', 'na', 'ap', 'kr', 'latam', 'br'];

/** `integrationStats` row `status:<source>` — the server's last run per source. */
export interface IntegrationStatus {
  ok: boolean;
  message: string;
  lastRun: number;
}

export interface ValorantStat {
  tier?: string;
  rr?: number;
  elo?: number;
  lastChange?: number;
  matches: number;
  minutes: number;
  modes: Record<string, number>;
}

export interface GdStat {
  stars: number;
  diamonds: number;
  coins: number;
  userCoins: number;
  demons: number;
  moons: number;
  levels: number;
}

export interface MusicCoachStat {
  minutes: number;
  sessions: number;
}

export const statId = (source: AutoSource, day: string) => `stat:${source}:${day}`;
export const statusId = (source: AutoSource) => `status:${source}`;
export const autoLogId = (source: AutoSource, habitId: string, day: string) => `auto:${source}:${habitId}:${day}`;

export function parseRiotId(s: string): { name: string; tag: string } | null {
  const m = s.trim().match(/^(.{3,16})#([A-Za-z0-9]{2,5})$/);
  return m ? { name: m[1].trim(), tag: m[2] } : null;
}
