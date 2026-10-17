import type { Stem } from "@/audio/separation/types";
import { type StemJobUsage, oldestStemJobFirst } from "@/domain/storage/usage";
import { STEM_STORE_NAME, getFromStore, runTransaction } from "@/lib/persistence-idb";
import { notifyStorageSignal, reportStorageWriteError } from "@/lib/storage-signals";
import type { VocalModelVariant } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

interface StemRecord {
  blob: Blob;
  createdAt: number;
  jobKey: string;
}

interface StemRemoval {
  jobs: number;
  bytes: number;
}

// -- Constants ----------------------------------------------------------------

const MAX_ENTRIES = 3;
const STEM_CACHE_VERSION = 2;
const ONSETS_CACHE_VERSION = 1;

// -- Module state -------------------------------------------------------------

const loadingStemJobs = new Map<string, number>();

// -- Stem jobs in use ---------------------------------------------------------

function beginLoadingStemJob(jobKey: string): void {
  loadingStemJobs.set(jobKey, (loadingStemJobs.get(jobKey) ?? 0) + 1);
}

function endLoadingStemJob(jobKey: string): void {
  const count = loadingStemJobs.get(jobKey) ?? 0;
  if (count <= 1) loadingStemJobs.delete(jobKey);
  else loadingStemJobs.set(jobKey, count - 1);
}

function isStemJobLoading(jobKey: string): boolean {
  return loadingStemJobs.has(jobKey);
}

// -- Keys ---------------------------------------------------------------------

function makeKey(audioHash: string, stem: Stem, variant: VocalModelVariant): string {
  return `${audioHash}|${stem}|${variant}|v${STEM_CACHE_VERSION}`;
}

function stemJobKey(audioHash: string, variant: VocalModelVariant): string {
  return `${audioHash}|${variant}|v${STEM_CACHE_VERSION}`;
}

function onsetsKey(jobKey: string): string {
  return `${jobKey}|onsets|v${ONSETS_CACHE_VERSION}`;
}

// -- Reads --------------------------------------------------------------------

async function getStem(audioHash: string, stem: Stem, variant: VocalModelVariant): Promise<Blob | null> {
  const record = await getFromStore<StemRecord>(STEM_STORE_NAME, makeKey(audioHash, stem, variant));
  return record?.blob ?? null;
}

async function hasStems(audioHash: string, variant: VocalModelVariant): Promise<boolean> {
  const vocals = await getStem(audioHash, "vocals", variant);
  if (!vocals) return false;
  const instrumental = await getStem(audioHash, "instrumental", variant);
  return instrumental !== null;
}

function isOnsetList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((point) => typeof point === "number");
}

async function getStemJobOnsets(jobKey: string): Promise<number[] | null> {
  const record = await getFromStore<StemRecord>(STEM_STORE_NAME, onsetsKey(jobKey));
  if (!record) return null;
  const parsed: unknown = JSON.parse(await record.blob.text());
  return isOnsetList(parsed) ? parsed : null;
}

async function readStemRecords(): Promise<StemRecord[]> {
  const records: StemRecord[] = [];
  await runTransaction([STEM_STORE_NAME], "readonly", (tx) => {
    const request = tx.objectStore(STEM_STORE_NAME).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      records.push(cursor.value as StemRecord);
      cursor.continue();
    };
  });
  return records;
}

function groupStemJobs(records: readonly StemRecord[]): StemJobUsage[] {
  const jobs = new Map<string, StemJobUsage>();
  for (const record of records) {
    const job = jobs.get(record.jobKey) ?? { jobKey: record.jobKey, bytes: 0, createdAt: 0 };
    job.bytes += record.blob.size;
    job.createdAt = Math.max(job.createdAt, record.createdAt);
    jobs.set(record.jobKey, job);
  }
  return [...jobs.values()];
}

async function listStemJobs(): Promise<StemJobUsage[]> {
  return groupStemJobs(await readStemRecords());
}

// -- Writes -------------------------------------------------------------------

async function putStem(audioHash: string, stem: Stem, variant: VocalModelVariant, blob: Blob): Promise<void> {
  const record: StemRecord = { blob, createdAt: Date.now(), jobKey: stemJobKey(audioHash, variant) };
  try {
    await runTransaction([STEM_STORE_NAME], "readwrite", (tx) => {
      tx.objectStore(STEM_STORE_NAME).put(record, makeKey(audioHash, stem, variant));
    });
  } catch (error) {
    reportStorageWriteError(error);
    throw error;
  }
  notifyStorageSignal("media-stored");
  await evictIfOverCapacity();
}

async function putStemJobOnsets(jobKey: string, onsets: readonly number[]): Promise<boolean> {
  const key = onsetsKey(jobKey);
  // createdAt 0 keeps derived data from making the job look newer to eviction.
  const record: StemRecord = {
    blob: new Blob([JSON.stringify(onsets)], { type: "application/json" }),
    createdAt: 0,
    jobKey,
  };
  let written = false;
  try {
    await runTransaction([STEM_STORE_NAME], "readwrite", (tx) => {
      const store = tx.objectStore(STEM_STORE_NAME);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (cursor.key !== key && (cursor.value as StemRecord).jobKey === jobKey) {
          store.put(record, key);
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

// -- Removal ------------------------------------------------------------------

async function deleteStemRecords(shouldDelete: (jobKey: string) => boolean): Promise<StemRemoval> {
  const removedJobs = new Set<string>();
  let bytes = 0;
  await runTransaction([STEM_STORE_NAME], "readwrite", (tx) => {
    const request = tx.objectStore(STEM_STORE_NAME).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const record = cursor.value as StemRecord;
      if (shouldDelete(record.jobKey)) {
        removedJobs.add(record.jobKey);
        bytes += record.blob.size;
        cursor.delete();
      }
      cursor.continue();
    };
  });
  if (removedJobs.size > 0) notifyStorageSignal("media-removed");
  return { jobs: removedJobs.size, bytes };
}

function removeStemJobs(
  jobKeys: readonly string[],
  isInUse: (jobKey: string) => boolean = () => false,
): Promise<StemRemoval> {
  const doomed = new Set(jobKeys);
  return deleteStemRecords((jobKey) => doomed.has(jobKey) && !isInUse(jobKey));
}

function clearStemCache(isInUse: (jobKey: string) => boolean): Promise<StemRemoval> {
  return deleteStemRecords((jobKey) => !isInUse(jobKey));
}

async function evictIfOverCapacity(): Promise<void> {
  const jobs = await listStemJobs();
  if (jobs.length <= MAX_ENTRIES) return;
  const oldest = jobs.toSorted(oldestStemJobFirst).slice(0, jobs.length - MAX_ENTRIES);
  await removeStemJobs(oldest.map((job) => job.jobKey));
}

// -- Exports ------------------------------------------------------------------

export {
  stemJobKey,
  getStem,
  getStemJobOnsets,
  hasStems,
  putStem,
  putStemJobOnsets,
  listStemJobs,
  removeStemJobs,
  clearStemCache,
  beginLoadingStemJob,
  endLoadingStemJob,
  isStemJobLoading,
};
export type { StemRemoval };
