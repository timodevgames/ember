import webpush from 'web-push';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Store } from './store';
import { buildReminder, localHour, userClock, type Reminder, type ReminderKind } from './reminders';
import { logicalDayTz } from './integrations/days';

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Hour (0–23) per reminder kind, or null = off. */
export interface PushPrefs {
  morning: number | null;
  evening: number | null;
}

export type SendResult = 'ok' | 'gone' | 'error';
export type Sender = (sub: PushSub, payload: Reminder & { url?: string }) => Promise<SendResult>;

/** VAPID keys are created once and kept in data/vapid.json (chmod 600). */
export function loadVapid(file: string): { publicKey: string; privateKey: string } {
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as { publicKey: string; privateKey: string };
  const keys = webpush.generateVAPIDKeys();
  writeFileSync(file, JSON.stringify(keys));
  chmodSync(file, 0o600);
  return keys;
}

export function makeSender(vapid: { publicKey: string; privateKey: string }, log: (m: string) => void): Sender {
  // The subject identifies the sender to Apple/Google push services.
  webpush.setVapidDetails('https://github.com/timodevgames/ember', vapid.publicKey, vapid.privateKey);
  return async (sub, payload) => {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 4 * 3600, urgency: 'normal', timeout: 15_000 });
      return 'ok';
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      log(`push ${status ?? ''} ${(e as Error).message}`.trim());
      return status === 404 || status === 410 ? 'gone' : 'error';
    }
  };
}

/**
 * Runs every few minutes: inside the hour a user picked, compute that
 * reminder and send it — once per device, kind and day.
 */
export async function pushTick(store: Store, send: Sender, now = Date.now()): Promise<number> {
  const subs = store.pushAll<PushSub, PushPrefs>();
  if (subs.length === 0) return 0;
  const { tz, startHour } = userClock(store);
  const hour = localHour(now, tz);
  const day = logicalDayTz(now, tz, startHour);
  let sent = 0;
  // One replay per kind and tick, shared by all devices.
  const messages = new Map<ReminderKind, Reminder | null>();
  const message = (kind: ReminderKind) => {
    if (!messages.has(kind)) messages.set(kind, buildReminder(kind, store, now));
    return messages.get(kind)!;
  };
  for (const s of subs) {
    for (const kind of ['morning', 'evening'] as ReminderKind[]) {
      if (s.prefs[kind] !== hour) continue;
      const key = `${s.endpoint}|${kind}|${day}`;
      if (!store.pushMarkOnce(key)) continue;
      const msg = message(kind);
      if (!msg) continue;
      const r = await send(s.sub, { ...msg, url: './' });
      if (r === 'gone') store.pushDelete(s.endpoint);
      else if (r === 'error') store.pushUnmark(key); // transient — try again on the next tick this hour
      else sent++;
    }
  }
  return sent;
}
