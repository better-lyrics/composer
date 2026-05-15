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
const DB_VERSION = 1;
const STORE_NAME = "projects";
const CURRENT_PROJECT_KEY = "current";

// -- Helpers ------------------------------------------------------------------

function readProjectFromIDB(): Promise<RecoveredProject | undefined> {
  return new Promise((resolve, reject) => {
    const openReq = indexedDB.open(DB_NAME, DB_VERSION);
    openReq.onerror = () => reject(openReq.error ?? new Error("IndexedDB open failed"));
    openReq.onsuccess = () => {
      const db = openReq.result;
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

// -- Exports ------------------------------------------------------------------

export { readRecoveryMetadata, downloadRecoveryFile };
export type { RecoveryResult };
