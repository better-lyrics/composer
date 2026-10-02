// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[PersistenceIDB]";
const DB_NAME = "ttml-composer";
const DB_VERSION = 3;
const PROJECT_STORE_NAME = "projects";
const STEM_STORE_NAME = "separated-stems";
const PROJECT_RECORD_STORE_NAME = "project-records";
const PROJECT_INDEX_STORE_NAME = "project-index";
const PROJECT_AUDIO_STORE_NAME = "project-audio";
const APP_STATE_STORE_NAME = "app-state";
const ALL_STORE_NAMES = [
  PROJECT_STORE_NAME,
  STEM_STORE_NAME,
  PROJECT_RECORD_STORE_NAME,
  PROJECT_INDEX_STORE_NAME,
  PROJECT_AUDIO_STORE_NAME,
  APP_STATE_STORE_NAME,
];

// -- Connection ---------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      for (const name of ALL_STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    request.onblocked = () => {
      console.warn(LOG_PREFIX, "database open blocked by another open connection; waiting for it to close");
    };
  });
}

// -- Generic CRUD -------------------------------------------------------------

async function getFromStore<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
    request.onsuccess = () => resolve(request.result as T | undefined);
    transaction.oncomplete = () => db.close();
  });
}

async function setInStore<T>(storeName: string, key: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const request = transaction.objectStore(storeName).put(value, key);
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
    request.onsuccess = () => resolve();
    transaction.oncomplete = () => db.close();
  });
}

async function deleteFromStore(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const request = transaction.objectStore(storeName).delete(key);
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
    request.onsuccess = () => resolve();
    transaction.oncomplete = () => db.close();
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
    request.onsuccess = () => resolve(request.result as T[]);
    transaction.oncomplete = () => db.close();
  });
}

type AbortTransaction = (reason: unknown) => void;

async function runTransaction(
  storeNames: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction, abort: AbortTransaction) => void,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    let closed = false;
    let workError: unknown;
    const closeOnce = () => {
      if (closed) return;
      closed = true;
      db.close();
    };
    transaction.oncomplete = () => {
      closeOnce();
      resolve();
    };
    transaction.onerror = (event) => {
      closeOnce();
      const requestError = event.target instanceof IDBRequest ? event.target.error : null;
      reject(workError ?? requestError ?? transaction.error ?? new Error("IndexedDB transaction failed"));
    };
    transaction.onabort = () => {
      closeOnce();
      reject(workError ?? transaction.error ?? new Error("IndexedDB transaction aborted"));
    };
    const abort: AbortTransaction = (reason) => {
      workError = reason;
      transaction.abort();
    };
    try {
      work(transaction, abort);
    } catch (error) {
      abort(error);
    }
  });
}

// -- Exports ------------------------------------------------------------------

export {
  DB_NAME,
  DB_VERSION,
  PROJECT_STORE_NAME,
  STEM_STORE_NAME,
  PROJECT_RECORD_STORE_NAME,
  PROJECT_INDEX_STORE_NAME,
  PROJECT_AUDIO_STORE_NAME,
  APP_STATE_STORE_NAME,
  openDB,
  getFromStore,
  getAllFromStore,
  setInStore,
  deleteFromStore,
  runTransaction,
};
export type { AbortTransaction };
