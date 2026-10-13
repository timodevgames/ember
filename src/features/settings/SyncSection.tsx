import { useEffect, useState } from 'react';
import { checkServer, connect, disconnect, getSyncConfig, makePairing, parsePairing, syncNow, useSyncStatus, type SyncConfig } from '../../state/sync';
import { isSandbox } from '../../core/sandbox';
import Sheet from '../../components/Sheet';

/** Settings card: pair this device with the Pixel server, see status, sync now. */
export default function SyncSection() {
  const status = useSyncStatus();
  const [cfg, setCfg] = useState<SyncConfig | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getSyncConfig().then(setCfg);
  }, [status.state]);

  if (isSandbox()) return <p className="text-sm text-zinc-400">Sync is off in the sandbox.</p>;
  if (cfg === undefined) return null;
  if (!cfg) return <PairingForm onDone={() => getSyncConfig().then(setCfg)} />;

  const ago = status.lastSyncAt ? timeAgo(status.lastSyncAt) : 'never';
  return (
    <div className="space-y-3">
      <p className="text-sm">
        {status.state === 'syncing' && <span className="text-zinc-300">⟳ Syncing…</span>}
        {status.state === 'idle' && <span className="text-emerald-300">✓ Synced {ago}</span>}
        {status.state === 'error' && <span className="text-hp-400">⚠️ {status.error}</span>}
        {status.state === 'off' && <span className="text-zinc-400">Connected · last sync {ago}</span>}
      </p>
      <p className="truncate text-xs text-zinc-500">{cfg.url}</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => syncNow()} className="rounded-xl bg-night-800 py-2.5 text-sm font-semibold">
          Sync now
        </button>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(makePairing(cfg));
            setCopied(true);
          }}
          className="rounded-xl bg-night-800 py-2.5 text-sm font-semibold"
        >
          {copied ? '✓ Copied' : 'Copy pairing code'}
        </button>
      </div>
      <p className="text-xs text-zinc-500">Paste the pairing code on another device to share the same pet. It works like a password — don't post it anywhere.</p>
      <button
        onClick={async () => {
          await disconnect();
          setCfg(null);
        }}
        className="text-sm text-hp-400"
      >
        Disconnect this device
      </button>
    </div>
  );
}

export function PairingForm({ onDone }: { onDone?: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<SyncConfig | null>(null);
  const parsed = parsePairing(code);

  const go = async () => {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const { hasData } = await checkServer(parsed);
      if (hasData) setAsk(parsed);
      else {
        await connect(parsed, false);
        onDone?.();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-400">
        Paste the pairing code from your Pixel server (or from another device's Settings → Sync).
      </p>
      <textarea value={code} onChange={(e) => setCode(e.target.value)} rows={3} placeholder="ember:…" className="w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 font-mono text-xs" aria-label="Pairing code" />
      {code && !parsed && <p className="text-xs text-hp-400">That doesn't look like a pairing code (it starts with “ember:”).</p>}
      {error && <p className="text-sm text-hp-400">{error}</p>}
      <button onClick={go} disabled={!parsed || busy} className="w-full rounded-xl bg-ember-500 py-3 font-bold text-night-950 disabled:opacity-40">
        {busy ? 'Connecting…' : 'Connect'}
      </button>

      <Sheet open={!!ask} onClose={() => setAsk(null)} title="The server already has data" center>
        <p className="mb-4 text-sm text-zinc-300">
          Use the synced pet and habits on this device? <b>Recommended</b> if this device is new or only has test data. “Merge” keeps both — you may end up with duplicate habits.
        </p>
        <div className="space-y-2">
          <button
            onClick={async () => {
              const c = ask!;
              setAsk(null);
              await connect(c, true);
              onDone?.();
            }}
            className="w-full rounded-xl bg-ember-500 py-3 font-bold text-night-950"
          >
            Use synced data (replace this device)
          </button>
          <button
            onClick={async () => {
              const c = ask!;
              setAsk(null);
              await connect(c, false);
              onDone?.();
            }}
            className="w-full rounded-xl bg-night-800 py-3 font-semibold"
          >
            Merge both
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}
