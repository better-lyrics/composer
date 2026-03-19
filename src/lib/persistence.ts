import type { Agent, GranularityMode, LyricLine, ProjectMetadata } from "@/stores/project";

// -- Types --------------------------------------------------------------------

interface SavedProject {
  version: 1;
  savedAt: number;
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: LyricLine[];
  granularity: GranularityMode;
  audioFileName?: string;
}

// -- Constants ----------------------------------------------------------------

const DB_NAME = "ttml-composer";
const DB_VERSION = 1;
const STORE_NAME = "projects";
const CURRENT_PROJECT_KEY = "current";

// -- IndexedDB Helpers --------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function getFromStore<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as T | undefined);

    transaction.oncomplete = () => db.close();
  });
}

async function setInStore<T>(key: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

async function deleteFromStore(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

// -- Public API ---------------------------------------------------------------

async function saveCurrentProject(
  metadata: ProjectMetadata,
  agents: Agent[],
  lines: LyricLine[],
  granularity: GranularityMode,
  audioFileName?: string,
): Promise<void> {
  const project: SavedProject = {
    version: 1,
    savedAt: Date.now(),
    metadata,
    agents,
    lines,
    granularity,
    audioFileName,
  };
  await setInStore(CURRENT_PROJECT_KEY, project);
}

async function loadCurrentProject(): Promise<SavedProject | undefined> {
  return getFromStore<SavedProject>(CURRENT_PROJECT_KEY);
}

async function clearCurrentProject(): Promise<void> {
  await deleteFromStore(CURRENT_PROJECT_KEY);
}

function exportProjectToFile(
  metadata: ProjectMetadata,
  agents: Agent[],
  lines: LyricLine[],
  granularity: GranularityMode,
  audioFileName?: string,
): void {
  const project: SavedProject = {
    version: 1,
    savedAt: Date.now(),
    metadata,
    agents,
    lines,
    granularity,
    audioFileName,
  };

  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${metadata.title || "project"}-${new Date().toISOString().slice(0, 10)}.ttml-project.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function importProjectFromFile(file: File): Promise<SavedProject> {
  const text = await file.text();
  const project = JSON.parse(text) as SavedProject;

  if (project.version !== 1) {
    throw new Error(`Unsupported project version: ${project.version}`);
  }

  return project;
}

// -- Debounced Auto-save ------------------------------------------------------

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSaveArgs: [ProjectMetadata, Agent[], LyricLine[], GranularityMode, string?] | null = null;
const SAVE_DELAY = 2000;

function debouncedSave(
  metadata: ProjectMetadata,
  agents: Agent[],
  lines: LyricLine[],
  granularity: GranularityMode,
  audioFileName?: string,
): void {
  pendingSaveArgs = [metadata, agents, lines, granularity, audioFileName];
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    if (pendingSaveArgs) {
      saveCurrentProject(...pendingSaveArgs).catch((err) =>
        console.error("[Persistence] Auto-save failed:", err),
      );
      pendingSaveArgs = null;
    }
    saveTimeout = null;
  }, SAVE_DELAY);
}

function cancelPendingSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  pendingSaveArgs = null;
}

function flushPendingSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (pendingSaveArgs) {
    saveCurrentProject(...pendingSaveArgs).catch((err) =>
      console.error("[Persistence] Flush save failed:", err),
    );
    pendingSaveArgs = null;
  }
}

// -- Exports ------------------------------------------------------------------

export {
  saveCurrentProject,
  loadCurrentProject,
  clearCurrentProject,
  exportProjectToFile,
  importProjectFromFile,
  debouncedSave,
  flushPendingSave,
  cancelPendingSave,
};
export type { SavedProject };
