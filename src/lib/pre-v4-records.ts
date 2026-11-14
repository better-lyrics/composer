import { APP_STATE_STORE_NAME, getFromStore, runTransaction } from "@/lib/persistence-idb";
import type { ProjectFile } from "@/lib/project-file";
import type { SavedProject } from "@/lib/saved-project";
import { reportStorageWriteError } from "@/lib/storage-signals";

// -- Types --------------------------------------------------------------------

interface PreV4Record {
  id: string;
  project: SavedProject;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[PreV4Records]";
const PRE_V4_KEY_PREFIX = "pre-v4:";
const PRE_V4_VERSION = 3;

// -- Keys ---------------------------------------------------------------------

function preV4Key(id: string): string {
  return `${PRE_V4_KEY_PREFIX}${id}`;
}

function preV4IdOf(key: string): string | undefined {
  return key.startsWith(PRE_V4_KEY_PREFIX) ? key.slice(PRE_V4_KEY_PREFIX.length) : undefined;
}

function preV4KeyRange(): IDBKeyRange {
  return IDBKeyRange.bound(PRE_V4_KEY_PREFIX, `${PRE_V4_KEY_PREFIX}\uffff`);
}

// -- Writes -------------------------------------------------------------------

function putPreV4RecordIfAbsent(tx: IDBTransaction, id: string, project: SavedProject): void {
  const store = tx.objectStore(APP_STATE_STORE_NAME);
  const existing = store.getKey(preV4Key(id));
  existing.onsuccess = () => {
    if (existing.result === undefined) store.put(project, preV4Key(id));
  };
}

function keepPreV4Record(tx: IDBTransaction, id: string, stored: SavedProject | undefined, next: SavedProject): void {
  if (stored?.version !== PRE_V4_VERSION || next.version <= PRE_V4_VERSION) return;
  putPreV4RecordIfAbsent(tx, id, stored);
}

function removePreV4Record(tx: IDBTransaction, id: string): void {
  tx.objectStore(APP_STATE_STORE_NAME).delete(preV4Key(id));
}

function removeAllPreV4Records(tx: IDBTransaction): void {
  tx.objectStore(APP_STATE_STORE_NAME).delete(preV4KeyRange());
}

async function restorePreV4Records(
  files: readonly ProjectFile[],
  restoredIds: ReadonlyMap<string, string>,
): Promise<void> {
  const copies = files.flatMap(({ projectId, ...project }) => {
    const id = projectId ? restoredIds.get(projectId) : undefined;
    return id ? [{ id, project }] : [];
  });
  if (copies.length === 0) return;
  try {
    await runTransaction([APP_STATE_STORE_NAME], "readwrite", (tx) => {
      for (const { id, project } of copies) putPreV4RecordIfAbsent(tx, id, project);
    });
  } catch (error) {
    console.error(LOG_PREFIX, "could not restore the earlier versions from the backup", error);
    reportStorageWriteError(error);
  }
}

// -- Reads --------------------------------------------------------------------

async function listPreV4Records(): Promise<PreV4Record[]> {
  const records: PreV4Record[] = [];
  await runTransaction([APP_STATE_STORE_NAME], "readonly", (tx) => {
    const request = tx.objectStore(APP_STATE_STORE_NAME).openCursor(preV4KeyRange());
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const id = preV4IdOf(String(cursor.key));
      if (id !== undefined) records.push({ id, project: cursor.value as SavedProject });
      cursor.continue();
    };
  });
  return records;
}

function loadPreV4Record(id: string): Promise<SavedProject | undefined> {
  return getFromStore<SavedProject>(APP_STATE_STORE_NAME, preV4Key(id));
}

// -- Exports ------------------------------------------------------------------

export {
  preV4Key,
  preV4IdOf,
  keepPreV4Record,
  restorePreV4Records,
  removePreV4Record,
  removeAllPreV4Records,
  listPreV4Records,
  loadPreV4Record,
};
export type { PreV4Record };
