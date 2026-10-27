import { type SavedProjectStem, type SavedProjectStems, storedStemBytes } from "@/domain/stems/saved-stems";
import { withLeadingSilence } from "@/audio/wav-encode";
import { STEM_SLOTS, type StemOrigin, type StemSlot } from "@/domain/stems/stem-slot";
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
import { fileExtensionLabel } from "@/utils/file-name";

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

const LOG_PREFIX = "[ProjectStems]";
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

function withoutSeparatedSlots(stems: SavedProjectStems): SavedProjectStems {
  const slots: SavedProjectStems["slots"] = {};
  for (const slot of STEM_SLOTS) {
    const stem = stems.slots[slot];
    if (stem && stem.origin !== "separated") slots[slot] = stem;
  }
  return { ...stems, revision: stems.revision + 1, slots };
}

// An imported mp3 was stored as the WAV of its decode, so the name is the only record of its format.
function isImportedMp3(stem: SavedProjectStem | undefined): stem is SavedProjectStem {
  return stem?.origin === "imported" && fileExtensionLabel(stem.name, "") === "MP3";
}

function withPaddedMp3Slots(stems: SavedProjectStems, seconds: number): SavedProjectStems | null {
  const revision = stems.revision + 1;
  const slots = { ...stems.slots };
  let padded = false;
  for (const slot of STEM_SLOTS) {
    const stem = stems.slots[slot];
    if (!isImportedMp3(stem)) continue;
    const data = withLeadingSilence(stem.data, seconds);
    if (!data) {
      console.warn(LOG_PREFIX, "left an imported mp3 stem unpadded; its bytes are not a WAV Composer wrote", stem.name);
      continue;
    }
    slots[slot] = { ...stem, data, durationSeconds: stem.durationSeconds + seconds, revision };
    padded = true;
  }
  return padded ? { ...stems, revision, slots } : null;
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

async function dropSeparatedProjectStems(id: string): Promise<boolean> {
  let dropped = false;
  await writeProjectStems(id, (current) => {
    if (!current || !STEM_SLOTS.some((slot) => current.slots[slot]?.origin === "separated")) return current;
    dropped = true;
    return withoutSeparatedSlots(current);
  });
  if (dropped) notifyStorageSignal("media-removed");
  return dropped;
}

async function padImportedMp3Stems(id: string, seconds: number): Promise<boolean> {
  let padded = false;
  await writeProjectStems(id, (current) => {
    const next = current ? withPaddedMp3Slots(current, seconds) : null;
    if (!next) return current;
    padded = true;
    return next;
  });
  if (padded) notifyStorageSignal("media-stored");
  return padded;
}

// -- Exports ------------------------------------------------------------------

export {
  copyProjectStems,
  deleteProjectStem,
  dropSeparatedProjectStems,
  loadProjectStems,
  padImportedMp3Stems,
  saveProjectStem,
  stemFile,
};
