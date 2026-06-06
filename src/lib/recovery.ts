// Standalone recovery helper. Reads the autosaved project directly from
// IndexedDB and triggers a file download, with zero dependencies on any
// store, hook, or component so it remains usable from error boundaries
// and `/recover` even when the rest of the app is in a broken state.

// -- Types --------------------------------------------------------------------

interface RecoveredProject {
  version?: number;
  savedAt?: number;
  metadata?: { title?: string };
  lines?: unknown[];
}

interface RecoveryResult {
  found: boolean;
  filename: string;
  lineCount: number;
  savedAt: number | undefined;
  title: string;
}

// -- Constants ----------------------------------------------------------------

const DB_NAME = "ttml-composer";
const DB_VERSION = 2;
const STORE_NAME = "projects";
const STEM_STORE_NAME = "separated-stems";
const CURRENT_PROJECT_KEY = "current";

// -- Helpers ------------------------------------------------------------------

// Mirrors the onupgradeneeded handler in `src/lib/persistence.ts`. If we open
// the DB without it and recovery runs before the main app has ever loaded
// (fresh browser hitting /recover or the panic shortcut), IndexedDB would
// materialise an empty DB at version 1 with no object store. The main app
// would then open that same version, skip its own onupgradeneeded, and every
// read/write would throw NotFoundError until the user clears site data. Keep
// the schema creation in lockstep with persistence.ts.
function openRecoveryDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(STEM_STORE_NAME)) {
        db.createObjectStore(STEM_STORE_NAME);
      }
    };
  });
}

async function readProjectFromIDB(): Promise<RecoveredProject | undefined> {
  const db = await openRecoveryDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.close();
      resolve(undefined);
      return;
    }
    const tx = db.transaction(STORE_NAME, "readonly");
    const getReq = tx.objectStore(STORE_NAME).get(CURRENT_PROJECT_KEY);
    getReq.onerror = () => {
      db.close();
      reject(getReq.error ?? new Error("IndexedDB read failed"));
    };
    getReq.onsuccess = () => {
      db.close();
      resolve(getReq.result as RecoveredProject | undefined);
    };
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// -- Public API ---------------------------------------------------------------

async function readRecoveryMetadata(): Promise<RecoveryResult> {
  const project = await readProjectFromIDB();
  if (!project) {
    return { found: false, filename: "", lineCount: 0, savedAt: undefined, title: "" };
  }
  const title = project.metadata?.title?.trim() || "recovered";
  const date = new Date().toISOString().slice(0, 10);
  return {
    found: true,
    filename: `${title}-${date}.ttml-project.json`,
    lineCount: project.lines?.length ?? 0,
    savedAt: project.savedAt,
    title,
  };
}

async function downloadRecoveryFile(): Promise<RecoveryResult> {
  const project = await readProjectFromIDB();
  if (!project) {
    return { found: false, filename: "", lineCount: 0, savedAt: undefined, title: "" };
  }
  const title = project.metadata?.title?.trim() || "recovered";
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${title}-${date}.ttml-project.json`;
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  triggerDownload(blob, filename);
  return {
    found: true,
    filename,
    lineCount: project.lines?.length ?? 0,
    savedAt: project.savedAt,
    title,
  };
}

async function clearRecoveryStorage(): Promise<void> {
  const db = await openRecoveryDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.close();
      resolve();
      return;
    }
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("IndexedDB clear failed"));
    };
  });
}

// -- Exports ------------------------------------------------------------------

export { readRecoveryMetadata, downloadRecoveryFile, clearRecoveryStorage };
export type { RecoveryResult };
