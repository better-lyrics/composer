import { PROJECT_STORE_NAME, setInStore } from "@/lib/persistence-idb";
import { LEGACY_AUDIO_KEY, LEGACY_PROJECT_KEY } from "@/lib/project-storage";

// -- Types ---------------------------------------------------------------------

interface SeedAudioFileArgs {
  name: string;
  type: string;
  data: ArrayBuffer;
}

// -- Helpers -------------------------------------------------------------------

function seedProject(project: unknown): Promise<void> {
  return setInStore(PROJECT_STORE_NAME, LEGACY_PROJECT_KEY, project);
}

function seedAudioFile(args: SeedAudioFileArgs): Promise<void> {
  return setInStore(PROJECT_STORE_NAME, LEGACY_AUDIO_KEY, args);
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`deleteDatabase(${name}) failed`));
    request.onblocked = () => resolve();
  });
}

function openAndCloseAtVersion(name: string, version: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => {};
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// -- Exports -------------------------------------------------------------------

export { seedProject, seedAudioFile, deleteDatabase, openAndCloseAtVersion };
