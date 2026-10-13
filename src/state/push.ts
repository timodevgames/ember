import { deviceId, getMeta, setMeta } from '../db/repo';
import { call, getSyncConfig } from './sync';

/**
 * Reminder notifications. The server (habits-api) decides what to say and when;
 * this device only subscribes. On iPhone, web push needs iOS 16.4+ AND the app
 * opened from the Home Screen — Safari tabs can't receive pushes.
 */
export interface ReminderPrefs {
  morning: number | null;
  evening: number | null;
}

export const DEFAULT_REMINDERS: ReminderPrefs = { morning: null, evening: 20 };

export type PushSupport = 'ok' | 'needs-install' | 'unsupported';

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function pushSupport(): PushSupport {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !isStandalone()) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return 'ok';
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Same transport as sync (token in a text/plain body); fails clearly when sync isn't connected. */
async function post<T = unknown>(path: string, body: object): Promise<T> {
  const cfg = await getSyncConfig();
  if (!cfg) throw new Error('Connect sync first — reminders are sent by your Pixel server.');
  return call<T>(cfg, path, body);
}

async function subscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/**
 * Ask permission, subscribe, register with the server. Call it straight from a
 * tap: iOS only shows the permission prompt while the tap still counts as a user
 * gesture, so `requestPermission` comes before any other await.
 */
export async function enableReminders(prefs: ReminderPrefs): Promise<void> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked. Allow them in iOS Settings → Notifications → Ember.');
  const cfg = await getSyncConfig();
  if (!cfg) throw new Error('Connect sync first — reminders are sent by your Pixel server.');
  const keyRes = await fetch(cfg.url + '/push/key', { signal: AbortSignal.timeout(15_000) });
  const { publicKey } = (await keyRes.json()) as { publicKey: string };
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error('The app is not installed yet (no service worker). Reload once and try again.');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  await post('/push/subscribe', { deviceId: deviceId(), subscription: sub.toJSON(), prefs });
  await setMeta('push.prefs', prefs);
}

export async function updateReminderPrefs(prefs: ReminderPrefs): Promise<void> {
  const sub = await subscription();
  if (!sub) {
    await setMeta('push.prefs', null);
    throw new Error('This device lost its reminder subscription — turn reminders on again.');
  }
  await post('/push/subscribe', { deviceId: deviceId(), subscription: sub.toJSON(), prefs });
  await setMeta('push.prefs', prefs);
}

/**
 * The real state of reminders on this device. Self-heals: if the browser still
 * has a subscription but the server forgot it (e.g. after an error), it is
 * registered again; if the browser lost it, reminders count as off.
 */
export async function getReminderPrefs(): Promise<ReminderPrefs | null> {
  const prefs = await getMeta<ReminderPrefs | null>('push.prefs', null);
  if (!prefs || !('serviceWorker' in navigator)) return prefs;
  const sub = await subscription().catch(() => null);
  if (!sub) {
    await setMeta('push.prefs', null);
    return null;
  }
  try {
    const r = await post<{ subscribed: boolean }>('/push/status', { endpoint: sub.endpoint });
    if (!r.subscribed) await post('/push/subscribe', { deviceId: deviceId(), subscription: sub.toJSON(), prefs });
  } catch {
    /* offline — keep showing the saved choice */
  }
  return prefs;
}

export async function disableReminders(): Promise<void> {
  const sub = await subscription();
  if (sub) {
    await post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  }
  await setMeta('push.prefs', null);
}

export async function sendTestReminder(): Promise<void> {
  const sub = await subscription();
  if (!sub) throw new Error('Reminders are not on for this device.');
  await post('/push/test', { endpoint: sub.endpoint });
}
