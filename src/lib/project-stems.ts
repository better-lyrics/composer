import { type SavedProjectStem, type SavedProjectStems, storedStemBytes } from "@/domain/stems/saved-stems";
import { readWavLayout, withLeadingSilence } from "@/audio/wav-encode";
import { measuredPrimingFrames } from "@/domain/stems/priming-evidence";
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

type SeparatedStemRepair = "drop" | "keep" | "undecided";

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

// A separated stem from the double-cropped decode is early, unless the song's crop did not change.
function isUncheckedSeparated(stem: SavedProjectStem | undefined): boolean {
  return stem?.origin === "separated" && !stem.primingCorrected;
}

// An imported mp3 was stored as the WAV of its decode, so the name is the only record of its format.
function measuredMp3StemPriming(stem: SavedProjectStem | undefined): number | null {
  if (stem?.origin !== "imported" || stem.primingCorrected || fileExtensionLabel(stem.name, "") !== "MP3") return null;
  const layout = readWavLayout(stem.data);
  return layout ? measuredPrimingFrames({ durationSeconds: stem.durationSeconds, ...layout }) : null;
}

function hasUncheckedSeparatedStems(stems: SavedProjectStems): boolean {
  return STEM_SLOTS.some((slot) => isUncheckedSeparated(stems.slots[slot]));
}

function hasStemsToRepair(stems: SavedProjectStems): boolean {
  return (
    hasUncheckedSeparatedStems(stems) || STEM_SLOTS.some((slot) => measuredMp3StemPriming(stems.slots[slot]) !== null)
  );
}

function repairedSlot(
  stem: SavedProjectStem,
  separated: SeparatedStemRepair,
  revision: number,
): SavedProjectStem | null | undefined {
  if (isUncheckedSeparated(stem)) {
    if (separated === "undecided") return stem;
    return separated === "drop" ? null : { ...stem, primingCorrected: true };
  }
  const cropped = measuredMp3StemPriming(stem);
  const data = cropped === null ? null : withLeadingSilence(stem.data, cropped);
  return data ? { ...stem, data, revision, primingCorrected: true } : stem;
}

function repairedStems(stems: SavedProjectStems, separated: SeparatedStemRepair): SavedProjectStems | null {
  const revision = stems.revision + 1;
  const slots: SavedProjectStems["slots"] = {};
  let changed = false;
  for (const slot of STEM_SLOTS) {
    const stem = stems.slots[slot];
    if (!stem) continue;
    const next = repairedSlot(stem, separated, revision);
    if (next !== stem) changed = true;
    if (next) slots[slot] = next;
  }
  return changed ? { ...stems, revision, slots } : null;
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
          const current = request.result as SavedProjectStems | undefined;
          const next = change(current);
          if (next === current) return;
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
    primingCorrected: true,
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

async function repairOldProjectStems(id: string, separated: SeparatedStemRepair): Promise<boolean> {
  let change: { before: number; after: number } | null = null;
  await writeProjectStems(id, (current) => {
    const next = current ? repairedStems(current, separated) : null;
    if (!next) return current;
    change = { before: storedStemBytes(current), after: storedStemBytes(next) };
    return next;
  });
  if (!change) return false;
  const { before, after } = change;
  notifyStorageSignal(after < before ? "media-removed" : "media-stored");
  return true;
}

// -- Exports ------------------------------------------------------------------

export type { SeparatedStemRepair };
export {
  copyProjectStems,
  deleteProjectStem,
  hasStemsToRepair,
  hasUncheckedSeparatedStems,
  loadProjectStems,
  repairOldProjectStems,
  saveProjectStem,
  stemFile,
};
