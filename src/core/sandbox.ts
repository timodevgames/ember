/**
 * Sandbox mode = a separate local database plus a "time machine" offset, so
 * the game can be tested (skip days, let the pet run away) without touching
 * real data. Switching reloads the app.
 */
const SANDBOX_KEY = 'ember.sandbox';
const OFFSET_KEY = 'ember.sandbox.offsetDays';

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    /* storage unavailable — sandbox simply stays off */
  }
}

export function isSandbox(): boolean {
  return read(SANDBOX_KEY) === '1';
}

export function setSandbox(on: boolean) {
  write(SANDBOX_KEY, on ? '1' : null);
  if (!on) write(OFFSET_KEY, null);
}

export function sandboxOffsetDays(): number {
  return isSandbox() ? Number(read(OFFSET_KEY) ?? 0) || 0 : 0;
}

export function setSandboxOffsetDays(n: number) {
  write(OFFSET_KEY, String(n));
}

/** "Now" for everything game-related. Real time unless the sandbox time machine is used. */
export function nowMs(): number {
  return Date.now() + sandboxOffsetDays() * 86_400_000;
}
