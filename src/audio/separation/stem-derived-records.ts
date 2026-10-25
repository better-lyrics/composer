import { STEM_STORE_NAME, getFromStore, runTransaction } from "@/lib/persistence-idb";
import { reportStorageWriteError } from "@/lib/storage-signals";

// -- Types --------------------------------------------------------------------

interface StemRecord {
  blob: Blob;
  createdAt: number;
  jobKey: string;
}

// -- Functions ----------------------------------------------------------------

function derivedRecordKey(jobKey: string, ...parts: readonly (string | number)[]): string {
  return [jobKey, ...parts].join("|");
}

async function getDerivedRecord(key: string): Promise<Blob | null> {
  const record = await getFromStore<StemRecord>(STEM_STORE_NAME, key);
  return record?.blob ?? null;
}

// Derived data lives only beside its stems: it is written only while a stem of the job exists,
// with createdAt 0 so it never makes the job look newer to eviction.
async function putDerivedRecords(jobKey: string, records: ReadonlyMap<string, Blob>): Promise<boolean> {
  if (records.size === 0) return false;
  let written = false;
  try {
    await runTransaction([STEM_STORE_NAME], "readwrite", (tx) => {
      const store = tx.objectStore(STEM_STORE_NAME);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const existing = cursor.value as StemRecord;
        if (existing.jobKey === jobKey && existing.createdAt > 0) {
          for (const [key, blob] of records) store.put({ blob, createdAt: 0, jobKey } satisfies StemRecord, key);
          written = true;
          return;
        }
        cursor.continue();
      };
    });
  } catch (error) {
    reportStorageWriteError(error);
    throw error;
  }
  return written;
}

// -- Exports ------------------------------------------------------------------

export { derivedRecordKey, getDerivedRecord, putDerivedRecords };
export type { StemRecord };
