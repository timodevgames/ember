import type { Purchase } from '../../db/types';

/**
 * Shop cosmetics. Bought with coins (a `cosmetic:<id>` purchase, so the replay
 * deducts the price), worn via the `pet.equipped` setting. Some unlock only at
 * later evolution stages. Prices assume ~40–50 coins on a good day.
 */
export interface Cosmetic {
  id: string;
  kind: 'hat' | 'bg';
  name: string;
  cost: number;
  minStage?: number;
}

export const COSMETICS: Cosmetic[] = [
  { id: 'hat-bow', kind: 'hat', name: 'Ribbon bow', cost: 250 },
  { id: 'hat-headphones', kind: 'hat', name: 'Studio headphones', cost: 400 },
  { id: 'hat-cap', kind: 'hat', name: 'Gamer cap', cost: 400 },
  { id: 'hat-beanie', kind: 'hat', name: 'Cozy beanie', cost: 500 },
  { id: 'hat-flowers', kind: 'hat', name: 'Flower crown', cost: 700, minStage: 2 },
  { id: 'hat-tophat', kind: 'hat', name: 'Top hat', cost: 1200, minStage: 3 },
  { id: 'hat-crown', kind: 'hat', name: 'Golden crown', cost: 2500, minStage: 4 },
  { id: 'bg-forest', kind: 'bg', name: 'Forest glade', cost: 300 },
  { id: 'bg-sunset', kind: 'bg', name: 'Sunset', cost: 450 },
  { id: 'bg-ocean', kind: 'bg', name: 'Deep ocean', cost: 600 },
  { id: 'bg-sakura', kind: 'bg', name: 'Cherry blossoms', cost: 800, minStage: 2 },
  { id: 'bg-galaxy', kind: 'bg', name: 'Galaxy', cost: 1500, minStage: 3 },
];

export const cosmeticItemId = (id: string) => `cosmetic:${id}`;

export function ownedCosmetics(purchases: Purchase[]): Set<string> {
  return new Set(purchases.filter((p) => !p.deleted && p.itemId.startsWith('cosmetic:')).map((p) => p.itemId.slice(9)));
}

/** What the pet actually wears: equipped AND still owned (a purchase can vanish via sync or a restore). */
export function wornCosmetics(equipped: { hat?: string; bg?: string } | undefined, purchases: Purchase[]): { hat?: string; bg?: string } {
  const owned = ownedCosmetics(purchases);
  return {
    hat: equipped?.hat && owned.has(equipped.hat) ? equipped.hat : undefined,
    bg: equipped?.bg && owned.has(equipped.bg) ? equipped.bg : undefined,
  };
}

/** CSS backgrounds for the pet scene. `null` = the default day/night sky. */
export const SCENES: Record<string, string> = {
  'bg-forest': 'radial-gradient(90% 60% at 50% 100%, #3d7a4a 0%, transparent 70%), linear-gradient(180deg, #1a3a26 0%, #0d1f15 100%)',
  'bg-sunset': 'linear-gradient(180deg, #ff9e5e 0%, #d9577a 45%, #3b2350 100%)',
  'bg-ocean': 'radial-gradient(70% 50% at 50% 0%, #3aa6c7 0%, transparent 70%), linear-gradient(180deg, #0f4c6b 0%, #082233 100%)',
  'bg-sakura': 'radial-gradient(60% 40% at 20% 10%, #ffd6e8 0%, transparent 60%), radial-gradient(60% 40% at 85% 25%, #ffc2dc 0%, transparent 60%), linear-gradient(180deg, #f6a5c6 0%, #6b3b5e 100%)',
  'bg-galaxy': 'radial-gradient(40% 35% at 30% 30%, rgba(167,139,250,.55) 0%, transparent 70%), radial-gradient(45% 40% at 75% 65%, rgba(56,189,248,.35) 0%, transparent 70%), linear-gradient(180deg, #0b0820 0%, #1a0f3a 100%)',
};

export function sceneBackground(bg: string | undefined, night: boolean, away: boolean): string {
  if (away) return 'linear-gradient(180deg, #0f2a22 0%, #13101d 100%)';
  if (bg && SCENES[bg]) return SCENES[bg];
  return night ? 'radial-gradient(120% 90% at 50% 100%, #2a2148 0%, #13101d 70%)' : 'radial-gradient(120% 90% at 50% 100%, #3a2433 0%, #181424 70%)';
}

/** Scenes that get twinkling star dots. */
export const STARRY = new Set(['bg-galaxy']);
