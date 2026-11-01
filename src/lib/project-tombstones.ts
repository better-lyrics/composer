import { APP_STATE_STORE_NAME, type AbortTransaction, getFromStore } from "@/lib/persistence-idb";

// -- Constants ----------------------------------------------------------------

const TOMBSTONE_KEY_PREFIX = "deleted-project:";

// -- Errors -------------------------------------------------------------------

class ProjectDeletedError extends Error {
  readonly projectId: string;

  constructor(projectId: string) {
    super(`Project ${projectId} was deleted`);
    this.name = "ProjectDeletedError";
    this.projectId = projectId;
  }
}

// -- Keys ---------------------------------------------------------------------

function tombstoneKey(id: string): string {
  return `${TOMBSTONE_KEY_PREFIX}${id}`;
}

// -- Transaction helpers ------------------------------------------------------

function writeTombstone(tx: IDBTransaction, id: string): void {
  tx.objectStore(APP_STATE_STORE_NAME).put(Date.now(), tombstoneKey(id));
}

function clearTombstone(tx: IDBTransaction, id: string): void {
  tx.objectStore(APP_STATE_STORE_NAME).delete(tombstoneKey(id));
}

function whenProjectWritable(tx: IDBTransaction, abort: AbortTransaction, id: string, write: () => void): void {
  const request = tx.objectStore(APP_STATE_STORE_NAME).get(tombstoneKey(id));
  request.onsuccess = () => {
    if (request.result !== undefined) {
      abort(new ProjectDeletedError(id));
      return;
    }
    try {
      write();
    } catch (error) {
      abort(error);
    }
  };
}

// -- Reads --------------------------------------------------------------------

async function isProjectDeleted(id: string): Promise<boolean> {
  return (await getFromStore<number>(APP_STATE_STORE_NAME, tombstoneKey(id))) !== undefined;
}

// -- Exports ------------------------------------------------------------------

export { ProjectDeletedError, writeTombstone, clearTombstone, whenProjectWritable, isProjectDeleted };
