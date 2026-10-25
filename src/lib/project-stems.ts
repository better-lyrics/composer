import { STEM_SLOTS, type StemOrigin, type StemSlot } from "@/domain/stems/stem-slot";
import {
  APP_STATE_STORE_NAME,
  PROJECT_INDEX_STORE_NAME,
  PROJECT_STEMS_STORE_NAME,
  getFromStore,
  runTransaction,
} from "@/lib/persistence-idb";
import { notifyProjectIndexChanged } from "@/lib/project-index-changes";
import { patchIndexEntry } from "@/lib/project-repository";
import { whenProjectWritable } from "@/lib/project-tombstones";
import { notifyStorageSignal, reportStorageWriteError } from "@/lib/storage-signals";

// -- Types --------------------------------------------------------------------

interface SavedProjectStem {
  origin: StemOrigin;
  name: string;
  type: string;
  data: ArrayBuffer;
  durationSeconds: number;
}

interface SavedProjectStems {
  songHash: string;
  revision: number;
  slots: Partial<Record<StemSlot, SavedProjectStem>>;
}

interface ProjectStemWrite {
  slot: StemSlot;
  file: File;
  origin: StemOrigin;
  durationSeconds: number;
}

type StemsChange = (current: SavedProjectStems | undefined) => SavedProjectStems | undefined;

// -- Constants ----------------------------------------------------------------

const STEM_WRITE_STORES = [PROJECT_STEMS_STORE_NAME, PROJECT_INDEX_STORE_NAME, APP_STATE_STORE_NAME];

// -- Helpers ------------------------------------------------------------------

function storedStemBytes(stems: SavedProjectStems | undefined): number {
  let total = 0;
  for (const slot of STEM_SLOTS) total += stems?.slots[slot]?.data.byteLength ?? 0;
  return total;
}

function stemFile(stem: SavedProjectStem): File {
  return new File([stem.data], stem.name, { type: stem.type });
}

function withoutSlot(stems: SavedProjectStems, slot: StemSlot): SavedProjectStems | undefined {
  const slots = { ...stems.slots };
  delete slots[slot];
  if (STEM_SLOTS.every((kept) => !slots[kept])) return undefined;
  return { ...stems, revision: stems.revision + 1, slots };
}

// -- Reads --------------------------------------------------------------------

function loadProjectStems(id: string): Promise<SavedProjectStems | undefined> {
  return getFromStore<SavedProjectStems>(PROJECT_STEMS_STORE_NAME, id);
}

// -- Writes -------------------------------------------------------------------

async function writeProjectStems(id: string, change: StemsChange): Promise<void> {
  try {
    await runTransaction(STEM_WRITE_STORES, "readwrite", (tx, abort) => {
      whenProjectWritable(tx, abort, id, () => {
        const store = tx.objectStore(PROJECT_STEMS_STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => {
          const next = change(request.result as SavedProjectStems | undefined);
          if (next) store.put(next, id);
          else store.delete(id);
          patchIndexEntry(tx, id, { storedStemBytes: storedStemBytes(next) });
        };
      });
    });
  } catch (error) {
    reportStorageWriteError(error);
    throw error;
  }
  notifyProjectIndexChanged();
}

async function saveProjectStem(id: string, songHash: string, write: ProjectStemWrite): Promise<void> {
  const stem: SavedProjectStem = {
    origin: write.origin,
    name: write.file.name,
    type: write.file.type,
    data: await write.file.arrayBuffer(),
    durationSeconds: write.durationSeconds,
  };
  await writeProjectStems(id, (current) => {
    const keptSlots = current?.songHash === songHash ? current.slots : {};
    return { songHash, revision: (current?.revision ?? 0) + 1, slots: { ...keptSlots, [write.slot]: stem } };
  });
  notifyStorageSignal("media-stored");
}

async function copyProjectStems(id: string, stems: SavedProjectStems): Promise<void> {
  await writeProjectStems(id, () => stems);
  notifyStorageSignal("media-stored");
}

async function deleteProjectStem(id: string, slot: StemSlot): Promise<void> {
  await writeProjectStems(id, (current) => (current ? withoutSlot(current, slot) : undefined));
  notifyStorageSignal("media-removed");
}

async function deleteProjectStems(id: string): Promise<void> {
  await writeProjectStems(id, () => undefined);
  notifyStorageSignal("media-removed");
}

// -- Exports ------------------------------------------------------------------

export {
  copyProjectStems,
  deleteProjectStem,
  deleteProjectStems,
  loadProjectStems,
  saveProjectStem,
  stemFile,
  storedStemBytes,
};
export type { SavedProjectStem, SavedProjectStems };
