import Dexie, { type EntityTable } from "dexie";

/** One queued offline sale. */
export interface OutboxRow {
  /** clientRef UUID — primary key, also the server's idempotency key. */
  clientRef: string;
  /** Local receipt number shown before sync, e.g. OFF-000042. */
  localReceiptNo: string;
  /** Serialized sales.completeSale input (includes clientRef). */
  payload: string;
  /** Cached total for list display (kobo). */
  totalKobo: number;
  createdAt: string; // ISO
  status: "pending" | "syncing" | "failed";
  attempts: number;
  lastError: string | null;
  /** Server receipt number once synced. */
  syncedReceiptNo: string | null;
}

export interface MenuCacheRow {
  id: string; // always "current"
  savedAt: string;
  /** FullMenu payload as JSON. */
  data: string;
}

export interface SyncLogRow {
  id?: number;
  at: string;
  level: "info" | "error";
  message: string;
}

const db = new Dexie("rbk-offline") as Dexie & {
  outbox: EntityTable<OutboxRow, "clientRef">;
  menuCache: EntityTable<MenuCacheRow, "id">;
  syncLog: EntityTable<SyncLogRow, "id">;
};

db.version(1).stores({
  outbox: "clientRef, status, createdAt",
  menuCache: "id",
  syncLog: "++id, at",
});

export async function nextLocalReceiptNo(): Promise<string> {
  const count = await db.outbox.count();
  // OFF- numbering is per-device and only ever shown before sync.
  return `OFF-${String(count + 1).padStart(6, "0")}`;
}

export async function writeMenuCache(data: unknown): Promise<void> {
  await db.menuCache.put({ id: "current", savedAt: new Date().toISOString(), data: JSON.stringify(data) });
}

export async function readMenuCache(): Promise<unknown | null> {
  const row = await db.menuCache.get("current");
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

export async function logSync(level: "info" | "error", message: string): Promise<void> {
  await db.syncLog.add({ at: new Date().toISOString(), level, message });
  // Keep the log bounded.
  const total = await db.syncLog.count();
  if (total > 200) {
    const oldest = await db.syncLog.orderBy("id").limit(total - 200).primaryKeys();
    await db.syncLog.bulkDelete(oldest);
  }
}

export { db };
