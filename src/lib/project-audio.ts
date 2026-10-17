import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { isCachedYouTubeAudio } from "@/domain/storage/stored-audio";
import {
  APP_STATE_STORE_NAME,
  PROJECT_AUDIO_STORE_NAME,
  PROJECT_INDEX_STORE_NAME,
  getFromStore,
  runTransaction,
} from "@/lib/persistence-idb";
import { notifyProjectIndexChanged } from "@/lib/project-index-changes";
import { patchIndexEntry } from "@/lib/project-repository";
import { whenProjectWritable } from "@/lib/project-tombstones";
import type { SavedAudioFile } from "@/lib/saved-project";
import { notifyStorageSignal } from "@/lib/storage-signals";

// -- Types --------------------------------------------------------------------

interface AudioRemoval {
  projects: number;
  bytes: number;
}

type AudioDeletion = "removed" | "absent" | "in-use";

type ProjectInUse = (id: string) => boolean;

// -- Constants ----------------------------------------------------------------

const AUDIO_STORES = [PROJECT_AUDIO_STORE_NAME, PROJECT_INDEX_STORE_NAME];
const NEVER_IN_USE: ProjectInUse = () => false;

// -- Writes -------------------------------------------------------------------

async function saveProjectAudio(id: string, file: File): Promise<void> {
  const data = await file.arrayBuffer();
  const saved: SavedAudioFile = { name: file.name, type: file.type, data };
  await runTransaction([...AUDIO_STORES, APP_STATE_STORE_NAME], "readwrite", (tx, abort) => {
    whenProjectWritable(tx, abort, id, () => {
      tx.objectStore(PROJECT_AUDIO_STORE_NAME).put(saved, id);
      patchIndexEntry(tx, id, { storedAudioBytes: data.byteLength });
    });
  });
  notifyProjectIndexChanged();
  notifyStorageSignal("media-stored");
}

async function deleteProjectAudio(id: string, isInUse: ProjectInUse = NEVER_IN_USE): Promise<AudioDeletion> {
  const outcome: { deletion: AudioDeletion } = { deletion: "absent" };
  await runTransaction(AUDIO_STORES, "readwrite", (tx) => {
    const audio = tx.objectStore(PROJECT_AUDIO_STORE_NAME);
    const request = audio.get(id);
    request.onsuccess = () => {
      if (request.result === undefined) return;
      if (isInUse(id)) {
        outcome.deletion = "in-use";
        return;
      }
      outcome.deletion = "removed";
      audio.delete(id);
      patchIndexEntry(tx, id, { storedAudioBytes: 0 });
    };
  });
  if (outcome.deletion === "removed") {
    notifyProjectIndexChanged();
    notifyStorageSignal("media-removed");
  }
  return outcome.deletion;
}

// -- Reads --------------------------------------------------------------------

async function loadProjectAudio(id: string): Promise<File | undefined> {
  const saved = await getFromStore<SavedAudioFile>(PROJECT_AUDIO_STORE_NAME, id);
  if (!saved) return undefined;
  return new File([saved.data], saved.name, { type: saved.type });
}

async function unindexedAudioBytes(): Promise<number> {
  let total = 0;
  await runTransaction(AUDIO_STORES, "readonly", (tx) => {
    const audio = tx.objectStore(PROJECT_AUDIO_STORE_NAME);
    const audioKeys = audio.getAllKeys();
    const indexKeys = tx.objectStore(PROJECT_INDEX_STORE_NAME).getAllKeys();
    indexKeys.onsuccess = () => {
      const indexed = new Set(indexKeys.result.map(String));
      for (const key of audioKeys.result) {
        if (indexed.has(String(key))) continue;
        const request = audio.get(key);
        request.onsuccess = () => {
          total += (request.result as SavedAudioFile | undefined)?.data.byteLength ?? 0;
        };
      }
    };
  });
  return total;
}

// -- Cache removal ------------------------------------------------------------

async function deleteCachedYouTubeAudio(shouldRemove: ProjectInUse): Promise<AudioRemoval> {
  const removal: AudioRemoval = { projects: 0, bytes: 0 };
  await runTransaction(AUDIO_STORES, "readwrite", (tx) => {
    const audio = tx.objectStore(PROJECT_AUDIO_STORE_NAME);
    const cursorRequest = tx.objectStore(PROJECT_INDEX_STORE_NAME).openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      const entry = cursor.value as ProjectIndexEntry;
      const id = String(cursor.key);
      if (isCachedYouTubeAudio(entry) && shouldRemove(id)) {
        audio.delete(id);
        cursor.update({ ...entry, storedAudioBytes: 0 });
        removal.projects += 1;
        removal.bytes += entry.storedAudioBytes;
      }
      cursor.continue();
    };
  });
  if (removal.projects > 0) {
    notifyProjectIndexChanged();
    notifyStorageSignal("media-removed");
  }
  return removal;
}

function removeCachedYouTubeAudio(ids: readonly string[], isInUse: ProjectInUse = NEVER_IN_USE): Promise<AudioRemoval> {
  const doomed = new Set(ids);
  return deleteCachedYouTubeAudio((id) => doomed.has(id) && !isInUse(id));
}

function clearCachedYouTubeAudio(isInUse: ProjectInUse): Promise<AudioRemoval> {
  return deleteCachedYouTubeAudio((id) => !isInUse(id));
}

// -- Exports ------------------------------------------------------------------

export {
  saveProjectAudio,
  loadProjectAudio,
  deleteProjectAudio,
  removeCachedYouTubeAudio,
  clearCachedYouTubeAudio,
  unindexedAudioBytes,
};
export type { AudioRemoval };
