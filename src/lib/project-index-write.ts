import { type ProjectIndexEntry, buildIndexEntry } from "@/domain/project/index-entry";
import { estimateRecordBytes } from "@/domain/project/record-bytes";
import type { ResumePosition } from "@/domain/project/resume-position";
import type { ProjectTab } from "@/domain/project/tab";
import { type SavedProjectStems, storedStemBytes } from "@/domain/stems/saved-stems";
import { PROJECT_AUDIO_STORE_NAME, PROJECT_INDEX_STORE_NAME, PROJECT_STEMS_STORE_NAME } from "@/lib/persistence-idb";
import type { SavedAudioFile, SavedProject } from "@/lib/saved-project";

// -- Types --------------------------------------------------------------------

interface IndexCarriedFields {
  storedAudioBytes: number;
  storedStemBytes?: number;
  openedAt?: number;
  lastTab?: ProjectTab;
  resumePosition?: ResumePosition;
}

interface IndexEntryWrite {
  id: string;
  project: SavedProject;
  lastTab?: ProjectTab;
  onFirstEntry?: () => void;
}

type IndexPatch = Partial<IndexCarriedFields>;
// -- Building -----------------------------------------------------------------

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
  return {
    storedAudioBytes: entry.storedAudioBytes,
    storedStemBytes: entry.storedStemBytes,
    openedAt: entry.openedAt,
    lastTab: entry.lastTab,
    resumePosition: entry.resumePosition,
  };
}

// -- Writing ------------------------------------------------------------------

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
      const stems = tx.objectStore(PROJECT_STEMS_STORE_NAME).get(id);
      stems.onsuccess = () => {
        const saved = audio.result as SavedAudioFile | undefined;
        const carried = {
          storedAudioBytes: saved?.data.byteLength ?? 0,
          storedStemBytes: storedStemBytes(stems.result as SavedProjectStems | undefined),
          openedAt: project.savedAt,
          lastTab,
        };
        index.put(indexEntryForProject(id, project, carried), id);
        if (count.result === 0) onFirstEntry?.();
      };
    };
  };
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

// -- Exports ------------------------------------------------------------------

export { indexEntryForProject, patchIndexEntry, writeIndexEntry };
export type { IndexPatch };
