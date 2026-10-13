import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../db/db';
import { proteinDensity, type FoodItem } from '../../core/nutrition/foods';
import { searchFoods } from '../../core/nutrition/search';
import { lookupBarcode, searchOff } from '../../core/nutrition/off';
import { cacheOffFood } from '../../state/food';
import { foodToItem } from '../../core/nutrition/foods';
import { useFoodIndex } from './useFoodIndex';
import BarcodeScanner from './BarcodeScanner';

type Tab = 'recent' | 'favorites' | 'mine';

interface Props {
  onPick: (item: FoodItem) => void;
  /** Where "create custom food" should return to. */
  returnTo: string;
  allowRecipes?: boolean;
}

export default function FoodSearch({ onPick, returnTo, allowRecipes = true }: Props) {
  const index = useFoodIndex();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('recent');
  const [online, setOnline] = useState<{ query: string; items: FoodItem[]; loading: boolean; error?: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [params, setParams] = useSearchParams();

  useEffect(() => () => abort.current?.abort(), []);

  // Coming back from "create food/recipe": open the new item straight away.
  const pickId = params.get('pick');
  useEffect(() => {
    if (!pickId || !index) return;
    const item = index.byId.get(pickId);
    if (!item) return;
    onPick(item);
    const next = new URLSearchParams(params);
    next.delete('pick');
    setParams(next, { replace: true });
  }, [pickId, index, onPick, params, setParams]);

  const pool = useMemo(() => (index ? index.items.filter((i) => allowRecipes || i.source !== 'recipe') : []), [index, allowRecipes]);
  const results = useMemo(() => (index && q.trim() ? searchFoods(pool, q, { boost: index.usage }) : []), [pool, q, index]);

  const goOnline = async () => {
    abort.current?.abort();
    const ctl = (abort.current = new AbortController());
    const query = q.trim();
    setOnline({ query, items: [], loading: true });
    try {
      const foods = await searchOff(query, ctl.signal);
      setOnline({ query, items: foods.map((f) => foodToItem({ ...f, updatedAt: 0 })), loading: false });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setOnline({ query, items: [], loading: false, error: navigator.onLine ? 'Open Food Facts search failed. Try again in a minute.' : 'You are offline.' });
    }
  };

  const onScan = useCallback(
    async (code: string) => {
      setScanning(false);
      setStatus(`Looking up ${code}…`);
      const local = await db.foods.where('barcode').equals(code).first();
      if (local && !local.deleted) {
        setStatus(null);
        onPick(foodToItem(local));
        return;
      }
      const r = await lookupBarcode(code);
      if (r.status === 'found') {
        const saved = await cacheOffFood(r.food);
        setStatus(null);
        onPick(foodToItem(saved));
        return;
      }
      if (r.status === 'error') {
        setStatus(r.message);
        return;
      }
      setStatus(null);
      const params = new URLSearchParams({ barcode: code, return: returnTo });
      if (r.status === 'incomplete' && r.name) params.set('name', r.name);
      nav(`/food/custom/new?${params}`);
    },
    [nav, onPick, returnTo],
  );

  if (!index) return null;
  const list = q.trim() ? results : tab === 'recent' ? index.recent : tab === 'favorites' ? index.favorites : index.mine;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOnline(null);
          }}
          placeholder="Search food (Deutsch or English)…"
          className="min-w-0 flex-1 rounded-2xl border border-night-600 bg-night-800 px-4 py-3"
          autoFocus
          aria-label="Search food"
        />
        <button onClick={() => setScanning(true)} className="rounded-2xl bg-night-800 px-4 text-xl" aria-label="Scan barcode">
          📷
        </button>
      </div>

      {status && <p className="rounded-xl bg-night-800 px-3 py-2 text-sm text-zinc-300">{status}</p>}
      {index.blsError && <p className="text-sm text-hp-400">Food table failed to load: {index.blsError}</p>}

      {!q.trim() && (
        <div className="flex gap-1.5">
          {(
            [
              ['recent', 'Recent'],
              ['favorites', '★ Favourites'],
              ['mine', 'My foods'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${tab === t ? 'bg-ember-500 text-night-950' : 'bg-night-800 text-zinc-400'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <ul className="space-y-1.5">
        {list.map((item) => (
          <ResultRow key={item.id} item={item} onPick={onPick} />
        ))}
      </ul>

      {!q.trim() && list.length === 0 && (
        <p className="px-1 text-sm text-zinc-500">
          {tab === 'recent' ? 'Foods you log show up here.' : tab === 'favorites' ? 'Tap ☆ on a food to keep it here.' : 'Your own foods and recipes live here.'}
        </p>
      )}
      {q.trim() && !index.blsLoaded && <p className="px-1 text-sm text-zinc-500">Loading food table…</p>}

      {q.trim() && (
        <div className="space-y-1.5 pt-1">
          {!online && (
            <button onClick={goOnline} className="w-full rounded-xl border border-dashed border-night-600 py-2.5 text-sm font-semibold text-zinc-300">
              🌍 Search Open Food Facts for “{q.trim()}”
            </button>
          )}
          {online?.loading && <p className="px-1 text-sm text-zinc-500">Searching Open Food Facts…</p>}
          {online?.error && <p className="px-1 text-sm text-hp-400">{online.error}</p>}
          {online && !online.loading && !online.error && online.items.length === 0 && <p className="px-1 text-sm text-zinc-500">No products found online.</p>}
          {online?.items.map((item) => (
            <ResultRow key={item.id} item={item} onPick={onPick} />
          ))}
        </div>
      )}

      <button onClick={() => nav(`/food/custom/new?${new URLSearchParams({ return: returnTo, name: q.trim() })}`)} className="w-full rounded-xl bg-night-800 py-2.5 text-sm font-semibold">
        ✏️ Create your own food
      </button>
      {allowRecipes && (
        <button onClick={() => nav(`/food/recipe/new?${new URLSearchParams({ return: returnTo })}`)} className="w-full rounded-xl bg-night-800 py-2.5 text-sm font-semibold">
          🥣 Build a recipe (shake, bowl…)
        </button>
      )}

      {scanning && <BarcodeScanner onResult={onScan} onClose={() => setScanning(false)} />}
    </div>
  );
}

function ResultRow({ item, onPick }: { item: FoodItem; onPick: (i: FoodItem) => void }) {
  const dense = proteinDensity(item.per100) >= 8;
  return (
    <li>
      <button onClick={() => onPick(item)} className="card flex w-full items-center gap-3 px-3.5 py-2.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {item.favorite && <span className="mr-1 text-gold-400">★</span>}
            {item.name}
          </span>
          <span className="block truncate text-xs text-zinc-500">
            {item.source === 'off' ? '🏷️ ' : item.source === 'recipe' ? '🥣 ' : item.source === 'custom' ? '✏️ ' : ''}
            {item.sub}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs tabular-nums">
          <span className="block text-zinc-300">{Math.round(item.per100.kcal)} kcal</span>
          <span className={`block ${dense ? 'font-bold text-protein-400' : 'text-zinc-500'}`}>{item.per100.protein} g P</span>
        </span>
      </button>
    </li>
  );
}
