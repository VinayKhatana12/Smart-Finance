import { ApiError } from './apiClient';
import { listPending, removePending, pendingCount, type PendingTransaction } from './offline-db';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'blocked-auth' | 'error' | 'done';

let listeners: Array<() => void> = [];
let status: SyncStatus = 'idle';
let lastError: string | null = null;
let syncing = false;

function notify(): void {
  for (const fn of listeners) fn();
}

export function onSyncChange(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function getSyncStatus(): SyncStatus {
  return navigator.onLine ? status : 'offline';
}

export function getLastError(): string | null {
  return lastError;
}

export interface SyncResult {
  synced: number;
  failed: number;
  remaining: number;
  status: SyncStatus;
}

/**
 * Flushes the offline outbox oldest-first, in order. Each submission carries
 * its idempotency key, so a retry after a timeout can never double-book — the
 * server returns the original transaction and the entry is removed.
 *
 * Auth failures stop the sync but KEEP the queue: the user signs in again and
 * presses retry. Validation failures (4xx, e.g. account deleted server-side)
 * drop the entry — it can never succeed.
 */
export async function syncPending(
  submit: (payload: PendingTransaction['payload']) => Promise<unknown>,
): Promise<SyncResult> {
  if (syncing) return { synced: 0, failed: 0, remaining: await pendingCount(), status };
  if (!navigator.onLine) {
    status = 'offline';
    notify();
    return { synced: 0, failed: 0, remaining: await pendingCount(), status };
  }

  syncing = true;
  status = 'syncing';
  notify();

  let synced = 0;
  let failed = 0;
  const queue = await listPending();

  for (const entry of queue) {
    try {
      await submit(entry.payload);
      await removePending(entry.clientRequestId);
      synced++;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401 || error.status === 403) {
          lastError = 'Your session expired. Sign in again to sync queued transactions.';
          status = 'blocked-auth';
          failed = queue.length - synced;
          notify();
          syncing = false;
          return { synced, failed, remaining: await pendingCount(), status };
        }
        if (error.status >= 400 && error.status < 500) {
          // permanently invalid (e.g. the account was deleted server-side)
          await removePending(entry.clientRequestId);
          failed++;
          lastError = `${failed} queued transaction(s) could not be synced and were discarded.`;
          continue;
        }
      }
      // network/server error: stop, keep everything for retry
      lastError = error instanceof Error ? error.message : 'Sync failed. Will retry.';
      status = 'error';
      failed = queue.length - synced;
      notify();
      syncing = false;
      return { synced, failed, remaining: await pendingCount(), status };
    }
  }

  syncing = false;
  status = queue.length > 0 ? 'done' : 'idle';
  if (status === 'done') lastError = null;
  notify();
  return { synced, failed, remaining: await pendingCount(), status };
}

/** Fired by the browser when connectivity returns. */
export function startConnectivityWatcher(submit: (payload: PendingTransaction['payload']) => Promise<unknown>): void {
  window.addEventListener('online', () => {
    void syncPending(submit).then(() => notify());
  });
  window.addEventListener('sf:pending-changed', () => notify());
}
