const DATABASE_NAME = "kinder-tasks-offline";
const DATABASE_VERSION = 1;

export interface OfflineSnapshot {
  key: string;
  familyId: string;
  childId: string;
  schemaVersion: 1;
  balanceCents: number;
  transactions: Array<{
    id: string;
    amountCents: number;
    type: string;
    description: string;
    effectiveAt: string;
  }>;
  tasks: Array<{
    assignmentId: string;
    title: string;
    description: string | null;
    rewardCents: number;
  }>;
  syncedAt: string;
  expiresAt: string;
}

export interface OfflineCompletion {
  clientRequestId: string;
  familyId: string;
  childId: string;
  assignmentId: string;
  status: "queued" | "syncing" | "synced" | "conflict" | "failed";
  createdAt: string;
  updatedAt: string;
  errorCode?: string;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("snapshots")) {
        database.createObjectStore("snapshots", { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains("queue")) {
        const queue = database.createObjectStore("queue", { keyPath: "clientRequestId" });
        queue.createIndex("by_status_created", ["status", "createdAt"]);
      }
      if (!database.objectStoreNames.contains("preferences")) {
        database.createObjectStore("preferences", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const current = database.transaction(storeName, mode);
    const request = operation(current.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    current.oncomplete = () => database.close();
    current.onerror = () => reject(current.error);
  });
}

export function snapshotKey(familyId: string, childId: string) {
  return `${familyId}:${childId}`;
}

export async function setOfflineEnabled(familyId: string, childId: string, enabled: boolean) {
  await transaction("preferences", "readwrite", (store) =>
    store.put({ key: snapshotKey(familyId, childId), enabled }),
  );
}

export async function isOfflineEnabled(familyId: string, childId: string) {
  const preference = await transaction<{ enabled?: boolean } | undefined>(
    "preferences",
    "readonly",
    (store) => store.get(snapshotKey(familyId, childId)),
  );
  return preference?.enabled === true;
}

export async function saveSnapshot(snapshot: OfflineSnapshot) {
  if (!(await isOfflineEnabled(snapshot.familyId, snapshot.childId))) return;
  await transaction("snapshots", "readwrite", (store) => store.put(snapshot));
}

export async function readSnapshot(familyId: string, childId: string) {
  const snapshot = await transaction<OfflineSnapshot | undefined>(
    "snapshots",
    "readonly",
    (store) => store.get(snapshotKey(familyId, childId)),
  );
  if (!snapshot || new Date(snapshot.expiresAt) <= new Date()) return null;
  return snapshot;
}

export async function enqueueCompletion(
  input: Omit<OfflineCompletion, "status" | "createdAt" | "updatedAt">,
) {
  const now = new Date().toISOString();
  const entry: OfflineCompletion = { ...input, status: "queued", createdAt: now, updatedAt: now };
  await transaction("queue", "readwrite", (store) => store.put(entry));
  return entry;
}

export async function listQueuedCompletions() {
  const entries = await transaction<OfflineCompletion[]>("queue", "readonly", (store) =>
    store.getAll(),
  );
  return entries
    .filter(
      (entry) =>
        entry.status === "queued" || entry.status === "syncing" || entry.status === "failed",
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function updateCompletionStatus(
  clientRequestId: string,
  status: OfflineCompletion["status"],
  errorCode?: string,
) {
  const current = await transaction<OfflineCompletion | undefined>("queue", "readonly", (store) =>
    store.get(clientRequestId),
  );
  if (!current) return;
  await transaction("queue", "readwrite", (store) =>
    store.put({ ...current, status, errorCode, updatedAt: new Date().toISOString() }),
  );
}

export async function clearOfflineData() {
  const database = await openDatabase();
  await Promise.all(
    ["snapshots", "queue", "preferences"].map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const current = database.transaction(name, "readwrite");
          const request = current.objectStore(name).clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
    ),
  );
  database.close();
}
