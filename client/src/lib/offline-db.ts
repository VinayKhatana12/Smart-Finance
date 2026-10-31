import { openDB, type IDBPDatabase } from 'idb';
import type { TransactionPayload } from '../features/transactions/api';

type QueuedPayload = TransactionPayload & { clientRequestId: string };

const DB_NAME = 'smartfinance-offline';
const STORE = 'pending-transactions';

export interface PendingTransaction {
  clientRequestId: string;
  payload: TransactionPayload;
  createdAt: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'clientRequestId' });
          store.createIndex('createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

/** Queues a transaction created while offline. The idempotency key is minted once. */
export async function queueTransaction(
  payload: Omit<TransactionPayload, 'clientRequestId'>,
): Promise<PendingTransaction> {
  const db = await getDb();
  const clientRequestId = crypto.randomUUID();
  const queued: PendingTransaction = {
    clientRequestId,
    payload: { ...payload, clientRequestId } as QueuedPayload,
    createdAt: new Date().toISOString(),
  };
  await db.put(STORE, queued);
  window.dispatchEvent(new Event('sf:pending-changed'));
  return queued;
}

export async function listPending(): Promise<PendingTransaction[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE)) as PendingTransaction[];
  return all.sort((x, y) => x.createdAt.localeCompare(y.createdAt)); // oldest first
}

export async function removePending(clientRequestId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, clientRequestId);
  window.dispatchEvent(new Event('sf:pending-changed'));
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE);
}
