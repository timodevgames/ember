import type { IncomingMessage, ServerResponse } from 'node:http';
import type { OffRequest, SyncRequest, SyncResponse } from '../src/core/sync/protocol';
import { readBody, send, tokenOk } from './http';
import type { Store } from './store';
import type { PushPrefs, PushSub, Sender } from './push';

export interface AppConfig {
  token: string;
  version: string;
  startedAt: number;
  fetchImpl?: typeof fetch;
  log?: (msg: string) => void;
  /** Runs the auto-checks now (the app's "Check now" button). */
  runIntegrations?: () => Promise<unknown>;
  push?: { publicKey: string; send: Sender };
}

const validHour = (h: unknown) => h === null || (Number.isInteger(h) && (h as number) >= 0 && (h as number) <= 23);

const OFF_FIELDS = 'code,product_name,product_name_de,product_name_en,brands,nutriments,serving_size,serving_quantity,quantity';
const OFF_UA = 'Ember/0.1 (github.com/timodevgames/ember; personal habit & nutrition tracker)';
const DAY = 86_400_000;

/** Request handler. The edge-proxy strips the public `/habits` prefix before it gets here. */
export function createHandler(store: Store, cfg: AppConfig) {
  const log = cfg.log ?? ((m: string) => console.log(`${new Date().toISOString()} ${m}`));
  const fetchFn = cfg.fetchImpl ?? fetch;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const path = new URL(req.url ?? '/', 'http://x').pathname.replace(/\/+$/, '') || '/';
    try {
      if (req.method === 'OPTIONS') return send(res, 204, null);

      if (req.method === 'GET' && path === '/push/key') {
        if (!cfg.push) return send(res, 404, { ok: false, error: 'push disabled' });
        return send(res, 200, { ok: true, publicKey: cfg.push.publicKey });
      }

      if (req.method === 'GET' && (path === '/' || path === '/health')) {
        return send(res, 200, { ok: true, service: 'habits-api', version: cfg.version, uptimeS: Math.round((Date.now() - cfg.startedAt) / 1000) });
      }

      if (req.method !== 'POST') return send(res, 404, { ok: false, error: 'not found' });
      const raw = await readBody(req);
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return send(res, 400, { ok: false, error: 'invalid JSON' });
      }
      if (!tokenOk(body.token, cfg.token)) {
        await new Promise((r) => setTimeout(r, 400)); // slow down guessing
        log(`401 ${path}`);
        return send(res, 401, { ok: false, error: 'wrong token' });
      }

      if (path === '/sync') {
        const r = body as unknown as SyncRequest;
        const changes = Array.isArray(r.changes) ? r.changes : [];
        const applied = store.merge(changes);
        const since = Number.isFinite(r.since) ? Number(r.since) : 0;
        const page = store.since(since);
        log(`sync ${String(r.deviceId).slice(0, 8)} in=${changes.length} applied=${applied} out=${page.changes.length} cursor=${page.cursor}`);
        const out: SyncResponse = { ok: true, ...page, applied, serverTime: Date.now() };
        return send(res, 200, out);
      }

      if (path === '/off/product') {
        const code = String((body as unknown as OffRequest).barcode ?? '');
        if (!/^\d{8,14}$/.test(code)) return send(res, 400, { ok: false, error: 'bad barcode' });
        const hit = store.offGet(code);
        const fresh = hit && Date.now() - hit.fetchedAt < (hit.status === 200 ? 30 * DAY : DAY);
        if (hit && fresh) return send(res, 200, { ok: true, cached: true, status: hit.status, product: JSON.parse(hit.body) });
        const r = await fetchFn(`https://world.openfoodfacts.org/api/v3/product/${code}?fields=${OFF_FIELDS}`, { headers: { 'user-agent': OFF_UA }, signal: AbortSignal.timeout(10_000) });
        const text = await r.text();
        let json: unknown = null;
        try {
          json = JSON.parse(text);
        } catch {
          /* OFF sometimes answers HTML when overloaded */
        }
        if (json && (r.status === 200 || r.status === 404)) store.offPut(code, r.status, JSON.stringify(json));
        log(`off ${code} → ${r.status}`);
        return send(res, 200, { ok: true, cached: false, status: r.status, product: json });
      }

      if (path === '/integrations/run') {
        if (!cfg.runIntegrations) return send(res, 404, { ok: false, error: 'integrations disabled' });
        return send(res, 200, { ok: true, result: await cfg.runIntegrations() });
      }

      if (path.startsWith('/push/')) {
        if (!cfg.push) return send(res, 404, { ok: false, error: 'push disabled' });
        const b = body as { deviceId?: string; subscription?: PushSub; prefs?: PushPrefs; endpoint?: string };
        if (path === '/push/subscribe') {
          const sub = b.subscription;
          const prefs = b.prefs;
          if (typeof b.deviceId !== 'string' || !b.deviceId || !sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth || !prefs || !validHour(prefs.morning) || !validHour(prefs.evening)) {
            return send(res, 400, { ok: false, error: 'bad subscription' });
          }
          store.pushUpsert(sub.endpoint, b.deviceId, sub, { morning: prefs.morning, evening: prefs.evening });
          log(`push subscribe ${b.deviceId.slice(0, 8)} morning=${prefs.morning} evening=${prefs.evening}`);
          return send(res, 200, { ok: true });
        }
        if (path === '/push/status') {
          return send(res, 200, { ok: true, subscribed: store.pushAll().some((x) => x.endpoint === b.endpoint) });
        }
        if (path === '/push/unsubscribe') {
          if (b.endpoint) store.pushDelete(b.endpoint);
          return send(res, 200, { ok: true });
        }
        if (path === '/push/test') {
          const s = store.pushAll<PushSub, PushPrefs>().find((x) => x.endpoint === b.endpoint);
          if (!s) return send(res, 404, { ok: false, error: 'This device has no reminder subscription on the server.' });
          const r = await cfg.push.send(s.sub, { title: 'Ember 🦊', body: 'Reminders work! You’ll hear from me at the times you picked.', tag: 'ember-test', url: './' });
          if (r === 'gone') store.pushDelete(s.endpoint);
          return send(res, r === 'ok' ? 200 : 502, r === 'ok' ? { ok: true } : { ok: false, error: r === 'gone' ? 'The push subscription expired — turn reminders off and on again.' : 'The push service refused the message.' });
        }
      }

      if (path === '/stats') return send(res, 200, { ok: true, tables: store.stats() });

      return send(res, 404, { ok: false, error: 'not found' });
    } catch (e) {
      log(`500 ${path}: ${(e as Error).message}`);
      return send(res, 500, { ok: false, error: 'server error' });
    }
  };
}
