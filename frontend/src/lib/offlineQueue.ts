// ─── OFFLINE REPORT QUEUE ───────────────────────────────────────────────────
// When a report is submitted with no connectivity (or the request fails for
// network reasons), it's stashed here — in IndexedDB, so it survives an app
// reload or a killed tab — instead of being lost. The app listens for the
// browser `online` event and periodically re-checks connectivity; the moment
// it's back, every pending report is POSTed in order. Each queued report
// carries a client-generated `offlineId` so a retried sync (e.g. the network
// blips again mid-upload) never creates a duplicate — the backend replays
// the original report instead (see POST /reports offlineId handling).
import { api } from "./api";

const DB_NAME = "sahabhagi_offline";
const DB_VERSION = 1;
const STORE = "pending_reports";

export interface PendingReport {
  offlineId: string;
  type: string;
  lat: number;
  lng: number;
  description: string;
  isAnonymous: boolean;
  /** Photo stored as a data URL so it survives structured cloning into IndexedDB. */
  imageDataUrl: string | null;
  queuedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "offlineId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(header)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

export async function queueOfflineReport(input: {
  type: string; lat: number; lng: number; description: string; isAnonymous: boolean; imageFile?: File | null;
}): Promise<PendingReport> {
  const imageDataUrl = input.imageFile ? await fileToDataUrl(input.imageFile) : null;
  const pending: PendingReport = {
    offlineId: `off-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: input.type,
    lat: input.lat,
    lng: input.lng,
    description: input.description,
    isAnonymous: input.isAnonymous,
    imageDataUrl,
    queuedAt: Date.now(),
  };
  await withStore("readwrite", store => store.put(pending));
  return pending;
}

export async function getPendingReports(): Promise<PendingReport[]> {
  try {
    return await withStore("readonly", store => store.getAll());
  } catch {
    return [];
  }
}

async function removePendingReport(offlineId: string): Promise<void> {
  await withStore("readwrite", store => store.delete(offlineId));
}

/**
 * Attempts to upload every queued report, in the order they were captured.
 * Stops at the first failure (keeps remaining reports queued) so a flaky
 * connection doesn't silently drop later reports out of order.
 */
export async function syncPendingReports(): Promise<{ synced: number; remaining: number }> {
  const pending = await getPendingReports();
  let synced = 0;

  for (const p of pending) {
    try {
      const fd = new FormData();
      fd.append("type", p.type);
      fd.append("lat", String(p.lat));
      fd.append("lng", String(p.lng));
      fd.append("description", p.description);
      fd.append("isAnonymous", String(p.isAnonymous));
      fd.append("offlineId", p.offlineId);
      if (p.imageDataUrl) {
        fd.append("photo", dataUrlToFile(p.imageDataUrl, `${p.offlineId}.jpg`));
      }
      await api.reports.submit(fd);
      await removePendingReport(p.offlineId);
      synced += 1;
    } catch {
      // Network's down again (or server unreachable) — stop here, keep the
      // rest queued for the next reconnect attempt.
      break;
    }
  }

  const remaining = (await getPendingReports()).length;
  return { synced, remaining };
}
