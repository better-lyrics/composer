import { type StemRemoval, clearStemCache } from "@/audio/separation/stem-store";
import { isProjectInUse } from "@/lib/open-project-session";
import { hiddenProjectIdsSnapshot } from "@/lib/pending-deletions";
import { flushPendingSave } from "@/lib/persistence-debounce";
import { type AudioRemoval, clearCachedYouTubeAudio, deleteProjectAudio } from "@/lib/project-audio";
import { type ProjectBundle, buildProjectBundle, downloadProjectBundle } from "@/lib/project-bundle";
import { listProjectRecords } from "@/lib/project-storage";
import { isStemJobInUse } from "@/stores/separation";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[StorageActions]";

// -- Actions ------------------------------------------------------------------

async function removeAudioFromProject(id: string): Promise<void> {
  if ((await deleteProjectAudio(id, isProjectInUse)) === "in-use") {
    throw new Error(`Project ${id} is open; close it to remove its audio`);
  }
}

function clearYouTubeAudio(): Promise<AudioRemoval> {
  return clearCachedYouTubeAudio(isProjectInUse);
}

function clearVocalStems(): Promise<StemRemoval> {
  return clearStemCache(isStemJobInUse);
}

async function backUpAllProjects(): Promise<ProjectBundle | null> {
  try {
    await flushPendingSave();
  } catch (error) {
    console.error(LOG_PREFIX, "could not flush the pending save before backing up", error);
  }
  const hidden = hiddenProjectIdsSnapshot();
  const records = (await listProjectRecords()).filter((record) => !hidden.has(record.id));
  if (records.length === 0) return null;
  const bundle = buildProjectBundle(records, Date.now());
  downloadProjectBundle(bundle);
  return bundle;
}

// -- Exports ------------------------------------------------------------------

export { removeAudioFromProject, clearYouTubeAudio, clearVocalStems, backUpAllProjects };
