import { type ProjectIndexEntry, buildIndexEntry } from "@/domain/project/index-entry";
import { estimateRecordBytes } from "@/domain/project/record-bytes";
import type { ProjectTab } from "@/domain/project/tab";
import { protectStorageForFirstProject } from "@/lib/browser-storage";
import {
  APP_STATE_STORE_NAME,
  type AbortTransaction,
  PROJECT_AUDIO_STORE_NAME,
  PROJECT_INDEX_STORE_NAME,
  PROJECT_RECORD_STORE_NAME,
  deleteFromStore,
  getAllFromStore,
  getFromStore,
  runTransaction,
} from "@/lib/persistence-idb";
import { announceProjectsDeleted } from "@/lib/project-channel";
import { notifyProjectIndexChanged } from "@/lib/project-index-changes";
import { OPEN_PROJECT_KEY, PROJECT_DATA_STORES } from "@/lib/project-storage";
import { clearTombstone, whenProjectWritable, writeTombstone } from "@/lib/project-tombstones";
import type { SavedAudioFile, SavedProject } from "@/lib/saved-project";
import { notifyStorageSignal } from "@/lib/storage-signals";
import { nanoid } from "nanoid";

// -- Types --------------------------------------------------------------------

interface IndexCarriedFields {
  storedAudioBytes: number;
  openedAt?: number;
  lastTab?: ProjectTab;
}

interface IndexEntryWrite {
  id: string;
  project: SavedProject;
  lastTab?: ProjectTab;
  onFirstEntry?: () => void;
}

type IndexPatch = Partial<IndexCarriedFields>;
type ProjectUpdate = (project: SavedProject) => SavedProject;

// -- Constants ----------------------------------------------------------------

const RECORD_WRITE_STORES = [
  PROJECT_RECORD_STORE_NAME,
  PROJECT_INDEX_STORE_NAME,
  PROJECT_AUDIO_STORE_NAME,
  APP_STATE_STORE_NAME,
];

// -- Identity -----------------------------------------------------------------

function createProjectId(): string {
  return nanoid();
}

function indexEntryForProject(id: string, project: SavedProject, carried: IndexCarriedFields): ProjectIndexEntry {
  return buildIndexEntry({
    id,
    metadata: project.metadata,
    lines: project.lines,
    audioSource: project.audioSource,
    updatedAt: project.savedAt,
    recordBytes: estimateRecordBytes(project),
    ...carried,
  });
}

function carriedIndexFields(entry: ProjectIndexEntry): IndexCarriedFields {
  return { storedAudioBytes: entry.storedAudioBytes, openedAt: entry.openedAt, lastTab: entry.lastTab };
}

// -- Open project pointer -----------------------------------------------------

function setOpenProjectId(id: string): Promise<void> {
  return runTransaction([APP_STATE_STORE_NAME], "readwrite", (tx, abort) => {
    whenProjectWritable(tx, abort, id, () => tx.objectStore(APP_STATE_STORE_NAME).put(id, OPEN_PROJECT_KEY));
  });
}

function clearOpenProjectId(): Promise<void> {
  return deleteFromStore(APP_STATE_STORE_NAME, OPEN_PROJECT_KEY);
}

// -- Records ------------------------------------------------------------------

function writeIndexEntry(tx: IDBTransaction, { id, project, lastTab, onFirstEntry }: IndexEntryWrite): void {
  const index = tx.objectStore(PROJECT_INDEX_STORE_NAME);
  const previous = index.get(id);
  previous.onsuccess = () => {
    const entry = previous.result as ProjectIndexEntry | undefined;
    if (entry) {
      const carried = carriedIndexFields(entry);
      index.put(indexEntryForProject(id, project, { ...carried, lastTab: lastTab ?? carried.lastTab }), id);
      return;
    }
    const count = index.count();
    count.onsuccess = () => {
      const audio = tx.objectStore(PROJECT_AUDIO_STORE_NAME).get(id);
      audio.onsuccess = () => {
        const saved = audio.result as SavedAudioFile | undefined;
        const carried = { storedAudioBytes: saved?.data.byteLength ?? 0, openedAt: project.savedAt, lastTab };
        index.put(indexEntryForProject(id, project, carried), id);
        if (count.result === 0) onFirstEntry?.();
      };
    };
  };
}

function writeProjectRecord(
  prepare: (tx: IDBTransaction, abort: AbortTransaction, write: () => void) => void,
  id: string,
  project: SavedProject,
  lastTab?: ProjectTab,
): Promise<void> {
  let createdFirstEntry = false;
  return runTransaction(RECORD_WRITE_STORES, "readwrite", (tx, abort) => {
    prepare(tx, abort, () => {
      tx.objectStore(PROJECT_RECORD_STORE_NAME).put(project, id);
      writeIndexEntry(tx, {
        id,
        project,
        lastTab,
        onFirstEntry: () => {
          createdFirstEntry = true;
        },
      });
    });
  }).then(() => {
    notifyProjectIndexChanged();
    if (createdFirstEntry) protectStorageForFirstProject();
  });
}

function saveProjectRecord(id: string, project: SavedProject, lastTab?: ProjectTab): Promise<void> {
  return writeProjectRecord((tx, abort, write) => whenProjectWritable(tx, abort, id, write), id, project, lastTab);
}

function restoreDeletedProjectRecord(id: string, project: SavedProject): Promise<void> {
  return writeProjectRecord(
    (tx, _abort, write) => {
      clearTombstone(tx, id);
      write();
    },
    id,
    project,
  );
}

async function saveProjectRecordWithAudio(id: string, project: SavedProject, audio: File | undefined): Promise<void> {
  const saved: SavedAudioFile | undefined = audio
    ? { name: audio.name, type: audio.type, data: await audio.arrayBuffer() }
    : undefined;
  let createdFirstEntry = false;
  await runTransaction(RECORD_WRITE_STORES, "readwrite", (tx, abort) => {
    whenProjectWritable(tx, abort, id, () => {
      if (saved) tx.objectStore(PROJECT_AUDIO_STORE_NAME).put(saved, id);
      tx.objectStore(PROJECT_RECORD_STORE_NAME).put(project, id);
      writeIndexEntry(tx, {
        id,
        project,
        onFirstEntry: () => {
          createdFirstEntry = true;
        },
      });
    });
  });
  notifyProjectIndexChanged();
  if (createdFirstEntry) protectStorageForFirstProject();
  if (saved) notifyStorageSignal("media-stored");
}

function updateProjectRecord(id: string, update: ProjectUpdate): Promise<void> {
  return runTransaction(RECORD_WRITE_STORES, "readwrite", (tx, abort) => {
    whenProjectWritable(tx, abort, id, () => {
      const records = tx.objectStore(PROJECT_RECORD_STORE_NAME);
      const current = records.get(id);
      current.onsuccess = () => {
        const project = current.result as SavedProject | undefined;
        if (!project) {
          abort(new Error(`Project ${id} is not stored in this browser`));
          return;
        }
        let next: SavedProject;
        try {
          next = update(project);
        } catch (error) {
          abort(error);
          return;
        }
        records.put(next, id);
        writeIndexEntry(tx, { id, project: next });
      };
    });
  }).then(notifyProjectIndexChanged);
}

// -- Index --------------------------------------------------------------------

function listProjectIndex(): Promise<ProjectIndexEntry[]> {
  return getAllFromStore<ProjectIndexEntry>(PROJECT_INDEX_STORE_NAME);
}

function loadProjectIndexEntry(id: string): Promise<ProjectIndexEntry | undefined> {
  return getFromStore<ProjectIndexEntry>(PROJECT_INDEX_STORE_NAME, id);
}

async function findProjectByVideoId(videoId: string): Promise<ProjectIndexEntry | undefined> {
  const matches = (await listProjectIndex()).filter((entry) => entry.videoId === videoId);
  return matches.toSorted((a, b) => b.updatedAt - a.updatedAt)[0];
}

function patchIndexEntry(tx: IDBTransaction, id: string, patch: IndexPatch, onWritten?: () => void): void {
  const index = tx.objectStore(PROJECT_INDEX_STORE_NAME);
  const request = index.get(id);
  request.onsuccess = () => {
    const entry = request.result as ProjectIndexEntry | undefined;
    if (entry) {
      index.put({ ...entry, ...patch }, id);
      onWritten?.();
    }
  };
}

function patchProjectIndex(id: string, patch: IndexPatch): Promise<void> {
  let wrote = false;
  return runTransaction([PROJECT_INDEX_STORE_NAME], "readwrite", (tx) =>
    patchIndexEntry(tx, id, patch, () => {
      wrote = true;
    }),
  ).then(() => {
    if (wrote) notifyProjectIndexChanged();
  });
}

function markProjectOpened(id: string, openedAt: number): Promise<void> {
  return patchProjectIndex(id, { openedAt });
}

function setProjectLastTab(id: string, lastTab: ProjectTab): Promise<void> {
  return patchProjectIndex(id, { lastTab });
}

// -- Removal ------------------------------------------------------------------

function removeProjectData(id: string): Promise<void> {
  return runTransaction([...PROJECT_DATA_STORES, APP_STATE_STORE_NAME], "readwrite", (tx) => {
    writeTombstone(tx, id);
    for (const name of PROJECT_DATA_STORES) tx.objectStore(name).delete(id);
    const appState = tx.objectStore(APP_STATE_STORE_NAME);
    const pointer = appState.get(OPEN_PROJECT_KEY);
    pointer.onsuccess = () => {
      if (pointer.result === id) appState.delete(OPEN_PROJECT_KEY);
    };
  }).then(() => {
    announceProjectsDeleted([id]);
    notifyProjectIndexChanged();
  });
}

// -- Exports ------------------------------------------------------------------

export {
  createProjectId,
  indexEntryForProject,
  setOpenProjectId,
  clearOpenProjectId,
  saveProjectRecord,
  restoreDeletedProjectRecord,
  saveProjectRecordWithAudio,
  updateProjectRecord,
  listProjectIndex,
  loadProjectIndexEntry,
  findProjectByVideoId,
  markProjectOpened,
  setProjectLastTab,
  patchIndexEntry,
  removeProjectData,
};
