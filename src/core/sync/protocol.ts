import type { SyncedTable, SyncFields } from '../../db/types';

/**
 * Wire format between the app and habits-api. Every call is a CORS "simple"
 * request — POST with a text/plain JSON body and the token inside it — so the
 * browser never sends a preflight and ngrok's browser warning never triggers.
 */
export type SyncRecord = SyncFields & Record<string, unknown>;

export interface Change {
  table: SyncedTable;
  record: SyncRecord;
}

export interface SyncRequest {
  token: string;
  deviceId: string;
  /** Server cursor from the last pull (0 = everything). */
  since: number;
  changes: Change[];
}

export type SyncResponse =
  | { ok: true; cursor: number; changes: Change[]; more: boolean; applied: number; serverTime: number }
  | { ok: false; error: string };

export interface OffRequest {
  token: string;
  barcode: string;
}
