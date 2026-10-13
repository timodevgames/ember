/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { createECDH, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import webpush from 'web-push';
import { Store } from './store';
import { buildReminder } from './reminders';
import { pushTick, type PushSub, type Sender } from './push';
import type { Change } from '../src/core/sync/protocol';

const TZ = 'Europe/Berlin';
// 2026-10-13 20:10 Berlin (CEST = UTC+2)
const EVENING = Date.UTC(2026, 9, 13, 18, 10);
const MORNING = Date.UTC(2026, 9, 13, 6, 5); // 08:05 Berlin

function seed(store: Store, opts: { pianoDone?: boolean; startDay?: string } = {}) {
  const habit = (id: string, difficulty: string): Change => ({
    table: 'habits',
    record: { id, updatedAt: 1, name: id === 'piano' ? 'Play piano' : 'Workout', icon: '', category: 'other', kind: 'check', target: 1, schedule: { type: 'daily' }, difficulty, order: 0, createdDay: '2026-10-01' },
  });
  const changes: Change[] = [
    habit('piano', 'medium'),
    habit('workout', 'hard'),
    { table: 'settings', record: { id: 'pet', updatedAt: 1, value: { name: 'Ember', color: 'ember', startDay: opts.startDay ?? '2026-10-10' } } },
    { table: 'settings', record: { id: 'integrations', updatedAt: 1, value: { timeZone: TZ } } },
  ];
  // perfect days before today so HP is full
  for (const d of ['2026-10-10', '2026-10-11', '2026-10-12']) {
    for (const h of ['piano', 'workout']) changes.push({ table: 'habitLogs', record: { id: `m:${h}:${d}`, updatedAt: 1, habitId: h, day: d, value: 1, source: 'manual', createdAt: 1 } });
  }
  if (opts.pianoDone) changes.push({ table: 'habitLogs', record: { id: 'm:piano:2026-10-13', updatedAt: 1, habitId: 'piano', day: '2026-10-13', value: 1, source: 'manual', createdAt: 1 } });
  store.merge(changes);
}

describe('reminder texts', () => {
  it('evening: warns about the HP loss the app would show and lists what is open', () => {
    const s = new Store(':memory:');
    seed(s);
    const r = buildReminder('evening', s, EVENING)!;
    expect(r.title).toBe('Ember 🦊');
    expect(r.body).toBe('⚠️ Ember loses 20 HP tonight (100 HP now). Still open: Play piano and Workout.');
  });

  it('evening: gentle when safe, silent when everything is done', () => {
    const s = new Store(':memory:');
    seed(s, { pianoDone: true }); // 2/5 of the weight done → 40 % → still loses HP
    expect(buildReminder('evening', s, EVENING)!.body).toMatch(/loses 10 HP/);
    s.merge([{ table: 'habitLogs', record: { id: 'm:workout:2026-10-13', updatedAt: 2, habitId: 'workout', day: '2026-10-13', value: 1, source: 'manual', createdAt: 1 } }]);
    expect(buildReminder('evening', s, EVENING)).toBeNull();
  });

  it('morning: plans the day', () => {
    const s = new Store(':memory:');
    seed(s);
    expect(buildReminder('morning', s, MORNING)!.body).toBe('☀️ 2 planned today: Play piano and Workout. Ember has 100 HP.');
  });

  it('no pet, no reminder', () => {
    expect(buildReminder('evening', new Store(':memory:'), EVENING)).toBeNull();
  });
});

describe('push scheduler', () => {
  const sub: PushSub = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'x', auth: 'y' } };

  it('sends inside the chosen hour, once per day', async () => {
    const s = new Store(':memory:');
    seed(s);
    s.pushUpsert(sub.endpoint, 'dev1', sub, { morning: null, evening: 20 });
    const sent: string[] = [];
    const send: Sender = async (_s, p) => (sent.push(p.body), 'ok');
    expect(await pushTick(s, send, EVENING - 30 * 60_000)).toBe(0); // 19:40 — not yet
    expect(await pushTick(s, send, EVENING)).toBe(1);
    expect(await pushTick(s, send, EVENING + 10 * 60_000)).toBe(0); // already sent today
    expect(sent).toHaveLength(1);
  });

  it('drops subscriptions the push service says are gone', async () => {
    const s = new Store(':memory:');
    seed(s);
    s.pushUpsert(sub.endpoint, 'dev1', sub, { morning: null, evening: 20 });
    await pushTick(s, async () => 'gone', EVENING);
    expect(s.pushAll()).toHaveLength(0);
  });

  it('keeps one subscription per device', () => {
    const s = new Store(':memory:');
    s.pushUpsert('https://a', 'dev1', sub, { morning: null, evening: 20 });
    s.pushUpsert('https://b', 'dev1', sub, { morning: 8, evening: 20 });
    expect(s.pushAll().map((x) => x.endpoint)).toEqual(['https://b']);
  });
});

describe('web push encryption', () => {
  it('produces an aes128gcm body the device can decrypt, with VAPID auth', () => {
    // http_ece ships with web-push — the reference implementation of RFC 8188.
    const ece = createRequire(import.meta.url)('http_ece') as { decrypt: (b: Buffer, p: Record<string, unknown>) => Buffer };
    const device = createECDH('prime256v1');
    device.generateKeys();
    const auth = randomBytes(16);
    const subscription = { endpoint: 'https://web.push.apple.com/QHello', keys: { p256dh: device.getPublicKey('base64url'), auth: auth.toString('base64url') } };
    const vapid = webpush.generateVAPIDKeys();
    const payload = JSON.stringify({ title: 'Ember 🦊', body: 'Reminders work!' });
    const req = webpush.generateRequestDetails(subscription, payload, {
      vapidDetails: { subject: 'https://github.com/timodevgames/ember', publicKey: vapid.publicKey, privateKey: vapid.privateKey },
      TTL: 60,
    });
    expect(req.headers['Content-Encoding']).toBe('aes128gcm');
    expect(String(req.headers.Authorization)).toMatch(/^vapid t=.+, k=/);
    const plain = ece.decrypt(req.body as Buffer, { version: 'aes128gcm', privateKey: device, authSecret: auth });
    expect(plain.toString('utf8')).toBe(payload);
  });
});

describe('push retries', () => {
  it('a transient send error is retried on the next tick', async () => {
    const s = new Store(':memory:');
    seed(s);
    const sub: PushSub = { endpoint: 'https://web.push.apple.com/r', keys: { p256dh: 'x', auth: 'y' } };
    s.pushUpsert(sub.endpoint, 'dev1', sub, { morning: null, evening: 20 });
    let fail = true;
    const send: Sender = async () => (fail ? 'error' : 'ok');
    expect(await pushTick(s, send, EVENING)).toBe(0);
    fail = false;
    expect(await pushTick(s, send, EVENING + 5 * 60_000)).toBe(1);
    expect(await pushTick(s, send, EVENING + 10 * 60_000)).toBe(0);
  });
});
