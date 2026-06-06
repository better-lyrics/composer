// -- Constants -----------------------------------------------------------------

const DB_NAME = "ttml-composer";
const DB_VERSION = 2;
const STORE_NAME = "projects";
const STEM_STORE_NAME = "separated-stems";
const CURRENT_KEY = "current";
const AUDIO_KEY = "current-audio";

// -- Helpers -------------------------------------------------------------------

function putValue(key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(STEM_STORE_NAME)) db.createObjectStore(STEM_STORE_NAME);
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE_NAME, "readwrite");
      const put = tx.objectStore(STORE_NAME).put(value, key);
      put.onerror = () => {
        db.close();
        reject(put.error);
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
}

async function seedProject(project: unknown): Promise<void> {
  return putValue(CURRENT_KEY, project);
}

interface SeedAudioFileArgs {
  name: string;
  type: string;
  data: ArrayBuffer;
}

async function seedAudioFile(args: SeedAudioFileArgs): Promise<void> {
  return putValue(AUDIO_KEY, args);
}

// -- Exports -------------------------------------------------------------------

export { seedProject, seedAudioFile };
