import { type SavedProjectStem, type SavedProjectStems, storedStemBytes } from "@/domain/stems/saved-stems";
import type { StemOrigin, StemSlot } from "@/domain/stems/stem-slot";
import {
  APP_STATE_STORE_NAME,
  PROJECT_INDEX_STORE_NAME,
  PROJECT_STEMS_STORE_NAME,
  getFromStore,
  runTransaction,
} from "@/lib/persistence-idb";
import { notifyProjectIndexChanged } from "@/lib/project-index-changes";
import { patchIndexEntry } from "@/lib/project-index-write";
import { whenProjectWritable } from "@/lib/project-tombstones";
import { notifyStorageSignal, reportStorageWriteError } from "@/lib/storage-signals";

// -- Types --------------------------------------------------------------------

interface ProjectStemWrite {
  slot: StemSlot;
  file: File;
  origin: StemOrigin;
  durationSeconds: number;
  shouldWrite?: () => boolean;
}

type StemsChange = (current: SavedProjectStems | undefined) => SavedProjectStems | undefined;

// -- Constants ----------------------------------------------------------------

const STEM_WRITE_STORES = [PROJECT_STEMS_STORE_NAME, PROJECT_INDEX_STORE_NAME, APP_STATE_STORE_NAME];

// -- Helpers ------------------------------------------------------------------

function stemFile(stem: SavedProjectStem): File {
  return new File([stem.data], stem.name, { type: stem.type });
}

// The record outlives its last stem, so a later import never reuses a revision and its stale derived data.
function withoutSlot(stems: SavedProjectStems, slot: StemSlot): SavedProjectStems {
  const slots = { ...stems.slots };
  delete slots[slot];
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

// Stems of another song are replaced; a stem the user imported is never replaced by the model's output.
function withStem(
  current: SavedProjectStems | undefined,
  songKey: string,
  slot: StemSlot,
  stem: Omit<SavedProjectStem, "revision">,
): SavedProjectStems {
  const sameSong = current?.songKey === songKey;
  if (sameSong && stem.origin === "separated" && current.slots[slot]?.origin === "imported") return current;
  const revision = (current?.revision ?? 0) + 1;
  const keptSlots = sameSong ? current.slots : {};
  return { songKey, revision, slots: { ...keptSlots, [slot]: { ...stem, revision } } };
}

async function saveProjectStem(id: string, songKey: string, write: ProjectStemWrite): Promise<void> {
  const stem = {
    origin: write.origin,
    name: write.file.name,
    type: write.file.type,
    data: await write.file.arrayBuffer(),
    durationSeconds: write.durationSeconds,
  };
  await writeProjectStems(id, (current) => {
    if (write.shouldWrite && !write.shouldWrite()) return current;
    return withStem(current, songKey, write.slot, stem);
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

// -- Exports ------------------------------------------------------------------

export { copyProjectStems, deleteProjectStem, loadProjectStems, saveProjectStem, stemFile };
