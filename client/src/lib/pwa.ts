import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { onSyncChange, getSyncStatus, syncPending, startConnectivityWatcher, type SyncStatus } from './sync';
import { pendingCount } from './offline-db';
import { createTransactionRequest } from '../features/transactions/api';

export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Service-worker registration + offline-ready flag + sync status/pending count. */
export function usePwa(): {
  offlineReady: boolean;
  needRefresh: boolean;
  updateApp: () => Promise<void>;
  online: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  syncNow: () => Promise<void>;
  installPrompt: { prompt: () => Promise<void> } | null;
} {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateApp, setUpdateApp] = useState<() => Promise<void>>(async () => {});
  const [pending, setPending] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<void> } | null>(null);
  const online = useOnline();

  useEffect(() => {
    const unregister = registerSW({
      immediate: true,
      onRegisteredSW: (_url, registration) => {
        if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
      },
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => setOfflineReady(true),
    });
    setUpdateApp(() => async () => {
      await unregister?.();
      setNeedRefresh(false);
    });
    return () => {
      void unregister?.();
    };
  }, []);

  useEffect(() => {
    void pendingCount().then(setPending);
    startConnectivityWatcher(async (payload) => {
      await createTransactionRequest(payload);
    });
    const off = onSyncChange(() => {
      void pendingCount().then(setPending);
    });
    return off;
  }, []);

  // beforeinstallprompt: captured once so Settings can offer one-tap install
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt({ prompt: () => (event as BeforeInstallPromptEvent).prompt() });
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const syncNow = async () => {
    await syncPending(async (payload) => {
      await createTransactionRequest(payload);
    });
  };

  return {
    offlineReady,
    needRefresh,
    updateApp,
    online,
    syncStatus: getSyncStatus(),
    pendingCount: pending,
    syncNow,
    installPrompt,
  };
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export { registerSW };
