import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * Service-worker updates. A new version is downloaded in the background; the
 * app shows a small banner and only reloads when you tap it. Checks for updates
 * on launch, when the app comes back to the foreground and hourly — an iPhone
 * home-screen app can stay alive for days without a real reload.
 */
let needRefresh = false;
const listeners = new Set<() => void>();
let update: ((reload?: boolean) => Promise<void>) | null = null;

export function startPwa(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  update = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh = true;
      for (const l of listeners) l();
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => reg.update().catch(() => {});
      setInterval(check, 60 * 60_000);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    },
  });
}

export function useUpdateReady(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => needRefresh,
  );
}

export function applyUpdate(): void {
  void update?.(true);
}
