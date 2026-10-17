import {
  APP_STATE_STORE_NAME,
  PROJECT_AUDIO_STORE_NAME,
  PROJECT_INDEX_STORE_NAME,
  PROJECT_RECORD_STORE_NAME,
  PROJECT_STORE_NAME,
  runTransaction,
} from "@/lib/persistence-idb";
import { protectStorageForFirstProject } from "@/lib/browser-storage";
import { createProjectId, indexEntryForProject } from "@/lib/project-repository";
import { LEGACY_AUDIO_KEY, LEGACY_PROJECT_KEY, OPEN_PROJECT_KEY, getOpenProjectId } from "@/lib/project-storage";
import type { SavedAudioFile, SavedProject } from "@/lib/saved-project";

// -- Constants ----------------------------------------------------------------

const MIGRATION_STORES = [
  PROJECT_STORE_NAME,
  PROJECT_RECORD_STORE_NAME,
  PROJECT_INDEX_STORE_NAME,
  PROJECT_AUDIO_STORE_NAME,
  APP_STATE_STORE_NAME,
];

// -- Migration ----------------------------------------------------------------

async function migrateLegacyProject(): Promise<string | undefined> {
  const id = createProjectId();
  let migrated = false;
  let movedRecord = false;
  await runTransaction(MIGRATION_STORES, "readwrite", (tx) => {
    const legacy = tx.objectStore(PROJECT_STORE_NAME);
    const pointer = tx.objectStore(APP_STATE_STORE_NAME).get(OPEN_PROJECT_KEY);
    pointer.onsuccess = () => {
      if (pointer.result !== undefined) return;
      const projectRequest = legacy.get(LEGACY_PROJECT_KEY);
      projectRequest.onsuccess = () => {
        const audioRequest = legacy.get(LEGACY_AUDIO_KEY);
        audioRequest.onsuccess = () => {
          const project = projectRequest.result as SavedProject | undefined;
          const audio = audioRequest.result as SavedAudioFile | undefined;
          if (!project && !audio) return;
          if (project) {
            tx.objectStore(PROJECT_RECORD_STORE_NAME).put(project, id);
            tx.objectStore(PROJECT_INDEX_STORE_NAME).put(
              indexEntryForProject(id, project, {
                storedAudioBytes: audio?.data.byteLength ?? 0,
                openedAt: project.savedAt,
              }),
              id,
            );
            movedRecord = true;
          }
          if (audio) tx.objectStore(PROJECT_AUDIO_STORE_NAME).put(audio, id);
          tx.objectStore(APP_STATE_STORE_NAME).put(id, OPEN_PROJECT_KEY);
          legacy.delete(LEGACY_PROJECT_KEY);
          legacy.delete(LEGACY_AUDIO_KEY);
          migrated = true;
        };
      };
    };
  });
  if (movedRecord) protectStorageForFirstProject();
  return migrated ? id : getOpenProjectId();
}

// -- Exports ------------------------------------------------------------------

export { migrateLegacyProject };
