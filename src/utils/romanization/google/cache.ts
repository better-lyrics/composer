interface GoogleCacheOpts {
  maxEntries: number;
  dbName?: string;
}

interface CacheEntry {
  romaji: string;
  accessedAt: number;
}

const DEFAULT_DB_NAME = "ttml-composer-romanization-cache";
const STORE_NAME = "entries";
const INDEX_ACCESSED = "accessedAt";
const KEY_SEPARATOR = "::";

function makeKey(sourceLang: string, sourceText: string): string {
  return `${sourceLang}${KEY_SEPARATOR}${sourceText}`;
}

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore(STORE_NAME);
      store.createIndex(INDEX_ACCESSED, "accessedAt");
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function awaitRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
    tx.onerror = () => reject(tx.error);
  });
}

class GoogleCache {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly maxEntries: number;
  private clock = 0;

  constructor(opts: GoogleCacheOpts) {
    this.dbName = opts.dbName ?? DEFAULT_DB_NAME;
    this.maxEntries = opts.maxEntries;
  }

  private nextAccessedAt(): number {
    const now = Date.now();
    this.clock = Math.max(now, this.clock + 1);
    return this.clock;
  }

  async open(): Promise<void> {
    if (this.db) return;
    this.db = await openDb(this.dbName);
    this.clock = await this.readMaxAccessedAt();
  }

  private async readMaxAccessedAt(): Promise<number> {
    const db = this.requireDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index(INDEX_ACCESSED);
    const cursorRequest = index.openCursor(null, "prev");
    const max = await new Promise<number>((resolve, reject) => {
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        const entry = cursor?.value as CacheEntry | undefined;
        resolve(entry?.accessedAt ?? 0);
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
    await awaitTransaction(tx);
    return max;
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  async get(sourceLang: string, sourceText: string): Promise<string | undefined> {
    const db = this.requireDb();
    const key = makeKey(sourceLang, sourceText);
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const existing = (await awaitRequest(store.get(key))) as CacheEntry | undefined;
    if (!existing) {
      await awaitTransaction(tx);
      return undefined;
    }
    const bumped: CacheEntry = { romaji: existing.romaji, accessedAt: this.nextAccessedAt() };
    store.put(bumped, key);
    await awaitTransaction(tx);
    return bumped.romaji;
  }

  async set(sourceLang: string, sourceText: string, romaji: string): Promise<void> {
    await this.setMany(sourceLang, [[sourceText, romaji]]);
  }

  async setMany(sourceLang: string, pairs: ReadonlyArray<readonly [string, string]>): Promise<void> {
    if (pairs.length === 0) return;
    const db = this.requireDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (let i = 0; i < pairs.length; i++) {
      const [sourceText, romaji] = pairs[i];
      const key = makeKey(sourceLang, sourceText);
      const entry: CacheEntry = { romaji, accessedAt: this.nextAccessedAt() };
      store.put(entry, key);
    }
    await awaitTransaction(tx);
    await this.evictIfOverCapacity();
  }

  async clearForTests(): Promise<void> {
    const db = this.requireDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    await awaitTransaction(tx);
  }

  private requireDb(): IDBDatabase {
    if (!this.db) throw new Error("GoogleCache is not open");
    return this.db;
  }

  private async evictIfOverCapacity(): Promise<void> {
    const db = this.requireDb();
    const countTx = db.transaction(STORE_NAME, "readonly");
    const count = await awaitRequest(countTx.objectStore(STORE_NAME).count());
    await awaitTransaction(countTx);
    if (count <= this.maxEntries) return;
    const toEvict = count - this.maxEntries;
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index(INDEX_ACCESSED);
    const cursorRequest = index.openCursor();
    let evicted = 0;
    await new Promise<void>((resolve, reject) => {
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || evicted >= toEvict) {
          resolve();
          return;
        }
        cursor.delete();
        evicted++;
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
    await awaitTransaction(tx);
  }
}

export { GoogleCache };
export type { GoogleCacheOpts };
