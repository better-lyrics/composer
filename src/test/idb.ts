// -- Constants -----------------------------------------------------------------

const DB_NAME = "ttml-composer";
const STORE_NAME = "projects";
const CURRENT_KEY = "current";

// -- Helpers -------------------------------------------------------------------

async function seedProject(project: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore(STORE_NAME);
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE_NAME, "readwrite");
      const put = tx.objectStore(STORE_NAME).put(project, CURRENT_KEY);
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

// -- Exports -------------------------------------------------------------------

export { seedProject };
