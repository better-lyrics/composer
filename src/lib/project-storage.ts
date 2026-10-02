import {
  APP_STATE_STORE_NAME,
  PROJECT_AUDIO_STORE_NAME,
  PROJECT_INDEX_STORE_NAME,
  PROJECT_RECORD_STORE_NAME,
  PROJECT_STORE_NAME,
  STEM_STORE_NAME,
  getFromStore,
  runTransaction,
} from "@/lib/persistence-idb";
import { announceProjectsDeleted } from "@/lib/project-channel";
import { notifyProjectIndexChanged } from "@/lib/project-index-changes";
import { isProjectDeleted, writeTombstone } from "@/lib/project-tombstones";
import type { SavedProject } from "@/lib/saved-project";

// -- Types --------------------------------------------------------------------

interface StoredProjectRecord {
  id: string;
  project: SavedProject;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[ProjectStorage]";
const OPEN_PROJECT_KEY = "open-project-id";
const LEGACY_PROJECT_KEY = "current";
const LEGACY_AUDIO_KEY = "current-audio";
const PROJECT_DATA_STORES = [PROJECT_RECORD_STORE_NAME, PROJECT_INDEX_STORE_NAME, PROJECT_AUDIO_STORE_NAME];

// -- Module state -------------------------------------------------------------

const projectsClearedListeners = new Set<() => void>();

// -- Reads --------------------------------------------------------------------

async function getOpenProjectId(): Promise<string | undefined> {
  const id = await getFromStore<string>(APP_STATE_STORE_NAME, OPEN_PROJECT_KEY);
  return id !== undefined && !(await isProjectDeleted(id)) ? id : undefined;
}

function loadProjectRecord(id: string): Promise<SavedProject | undefined> {
  return getFromStore<SavedProject>(PROJECT_RECORD_STORE_NAME, id);
}

async function listProjectRecords(): Promise<StoredProjectRecord[]> {
  const records: StoredProjectRecord[] = [];
  await runTransaction([PROJECT_RECORD_STORE_NAME], "readonly", (tx) => {
    const request = tx.objectStore(PROJECT_RECORD_STORE_NAME).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      records.push({ id: String(cursor.key), project: cursor.value as SavedProject });
      cursor.continue();
    };
  });
  return records;
}

// -- Removal ------------------------------------------------------------------

async function clearAllProjects(): Promise<void> {
  const stores = [PROJECT_STORE_NAME, STEM_STORE_NAME, ...PROJECT_DATA_STORES, APP_STATE_STORE_NAME];
  let clearedIds: string[] = [];
  await runTransaction(stores, "readwrite", (tx) => {
    const keyRequests = PROJECT_DATA_STORES.map((name) => tx.objectStore(name).getAllKeys());
    const appState = tx.objectStore(APP_STATE_STORE_NAME);
    const pointer = appState.get(OPEN_PROJECT_KEY);
    pointer.onsuccess = () => {
      const ids = new Set(keyRequests.flatMap((request) => request.result.map(String)));
      if (typeof pointer.result === "string") ids.add(pointer.result);
      for (const id of ids) writeTombstone(tx, id);
      for (const name of [PROJECT_STORE_NAME, STEM_STORE_NAME, ...PROJECT_DATA_STORES]) tx.objectStore(name).clear();
      appState.delete(OPEN_PROJECT_KEY);
      clearedIds = [...ids];
    };
  });
  for (const listener of projectsClearedListeners) {
    try {
      listener();
    } catch (error) {
      console.error(LOG_PREFIX, "onProjectsCleared listener failed", error);
    }
  }
  announceProjectsDeleted(clearedIds);
  notifyProjectIndexChanged();
}

// -- Lifecycle hooks ----------------------------------------------------------

function onProjectsCleared(listener: () => void): () => void {
  projectsClearedListeners.add(listener);
  return () => {
    projectsClearedListeners.delete(listener);
  };
}

// -- Exports ------------------------------------------------------------------

export {
  OPEN_PROJECT_KEY,
  PROJECT_DATA_STORES,
  LEGACY_PROJECT_KEY,
  LEGACY_AUDIO_KEY,
  getOpenProjectId,
  loadProjectRecord,
  listProjectRecords,
  clearAllProjects,
  onProjectsCleared,
};
