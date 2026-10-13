import { applyUpdate, useUpdateReady } from '../state/pwa';

export default function UpdateBanner() {
  const ready = useUpdateReady();
  if (!ready) return null;
  return (
    <button onClick={applyUpdate} className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-40 mx-auto max-w-md rounded-2xl bg-xp-400 px-4 py-3 text-left text-sm font-bold text-night-950 shadow-lg animate-rise-in">
      ✨ A new version of Ember is ready — tap to update
    </button>
  );
}
