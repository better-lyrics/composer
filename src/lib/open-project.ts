import {
  adoptOpenProjectId,
  beginOpeningProject,
  endOpeningProject,
  ensureOpenProjectId,
  findOpenProjectId,
  forgetOpenProjectId,
  openProjectIdSnapshot,
} from "@/lib/open-project-session";
import { buildSavedProject } from "@/lib/persistence";
import { cancelPendingSave, flushPendingSaveQuietly } from "@/lib/persistence-debounce";
import { saveProjectAudio } from "@/lib/project-audio";
import {
  createProjectId,
  markProjectOpened,
  removeProjectData,
  saveProjectRecord,
  setOpenProjectId,
} from "@/lib/project-repository";
import {
  EMPTY_RESTORE,
  type RestorePayload,
  applyProjectToStores,
  hasRestorableContent,
  hasStoredProject,
  loadProjectForRestore,
} from "@/lib/project-restore";
import { buildSaveInput, storedAudioFile } from "@/lib/project-snapshot";
import { clearAllProjects } from "@/lib/project-storage";
import { ProjectDeletedError, isProjectDeleted } from "@/lib/project-tombstones";
import { awaitInFlightSaves, trackSave } from "@/lib/save-status";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";

// -- Types --------------------------------------------------------------------

interface NewSongProject {
  newId: string;
  previousId: string;
  previousTitle: string;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[OpenProject]";

// -- Module state -------------------------------------------------------------

let latestRequest = 0;
let appliedRequest = 0;
let openProjectChanges = 0;

// -- Helpers ------------------------------------------------------------------

function logFailure(action: string): (error: unknown) => void {
  return (error) => console.error(LOG_PREFIX, action, error);
}

function claimRequest(): number {
  latestRequest++;
  appliedRequest = latestRequest;
  return latestRequest;
}

function markOpenProjectChanged(): void {
  openProjectChanges++;
}

// -- Boot ---------------------------------------------------------------------

async function restoreOpenProject(): Promise<void> {
  const baseline = openProjectChanges;
  const id = await findOpenProjectId();
  if (!id) return;
  const payload = await loadProjectForRestore(id);
  if (openProjectChanges !== baseline || !hasRestorableContent(payload)) return;
  applyProjectToStores(payload);
  markProjectOpened(id, Date.now()).catch(logFailure("could not record when the project was opened"));
}

// -- Switching ----------------------------------------------------------------

async function isOpenable(id: string, payload: RestorePayload): Promise<boolean> {
  return hasStoredProject(payload) && !(await isProjectDeleted(id));
}

async function openProject(id: string): Promise<void> {
  if (id === openProjectIdSnapshot()) {
    claimRequest();
    return;
  }
  flushPendingSaveQuietly();
  const request = ++latestRequest;
  beginOpeningProject(id);
  try {
    const payload = await loadProjectForRestore(id);
    const openable = await isOpenable(id, payload);
    if (request <= appliedRequest) return;
    if (!openable) {
      if (request !== latestRequest) return;
      throw new Error(`Project ${id} is not stored in this browser`);
    }
    appliedRequest = request;
    if (id === openProjectIdSnapshot()) return;
    markOpenProjectChanged();
    flushPendingSaveQuietly();
    adoptOpenProjectId(id);
    applyProjectToStores(payload);
    await Promise.all([
      setOpenProjectId(id).catch((error: unknown) => {
        if (error instanceof ProjectDeletedError) closeIfOpen(id);
        else logFailure("could not record the open project")(error);
      }),
      markProjectOpened(id, Date.now()).catch(logFailure("could not record when the project was opened")),
    ]);
  } finally {
    endOpeningProject(id);
  }
}

function createProject(): string {
  claimRequest();
  markOpenProjectChanged();
  flushPendingSaveQuietly();
  const id = createProjectId();
  adoptOpenProjectId(id);
  applyProjectToStores(EMPTY_RESTORE);
  setOpenProjectId(id).catch(logFailure("could not record the new project"));
  return id;
}

async function startSongInNewProject<T>(title: string, begin: (song: NewSongProject) => T): Promise<Awaited<T> | null> {
  let previousId: string;
  try {
    previousId = openProjectIdSnapshot() ?? (await ensureOpenProjectId());
  } catch (error) {
    console.error(LOG_PREFIX, "could not resolve the previous project, loading in place instead", error);
    return null;
  }
  const previousTitle = useProjectStore.getState().metadata.title;
  const newId = createProject();
  useProjectStore.getState().setMetadata({ title });
  return await begin({ newId, previousId, previousTitle });
}

// -- Reloading ----------------------------------------------------------------

async function reloadOpenProject(): Promise<void> {
  const id = openProjectIdSnapshot();
  if (!id) return;
  const request = claimRequest();
  markOpenProjectChanged();
  cancelPendingSave();
  const payload = await loadProjectForRestore(id);
  if (request !== latestRequest || id !== openProjectIdSnapshot()) return;
  applyProjectToStores(payload);
}

// -- Removal ------------------------------------------------------------------

function closeIfOpen(id: string): void {
  if (id !== openProjectIdSnapshot()) return;
  claimRequest();
  markOpenProjectChanged();
  cancelPendingSave();
  forgetOpenProjectId();
  applyProjectToStores(EMPTY_RESTORE);
}

async function deleteProject(id: string): Promise<void> {
  closeIfOpen(id);
  await removeProjectData(id);
  closeIfOpen(id);
}

async function closeAndClearAllProjects(): Promise<void> {
  claimRequest();
  markOpenProjectChanged();
  cancelPendingSave();
  await awaitInFlightSaves();
  await clearAllProjects();
  cancelPendingSave();
  forgetOpenProjectId();
  applyProjectToStores(EMPTY_RESTORE);
}

// -- Recovery -----------------------------------------------------------------

async function forkOpenProject(): Promise<string> {
  claimRequest();
  markOpenProjectChanged();
  cancelPendingSave();
  const id = createProjectId();
  adoptOpenProjectId(id);
  const args = buildSaveInput();
  if (args)
    await trackSave("project", saveProjectRecord(id, buildSavedProject(args), useProjectStore.getState().activeTab));
  const file = storedAudioFile(useAudioStore.getState().source);
  if (file) await trackSave("audio", saveProjectAudio(id, file));
  await setOpenProjectId(id);
  return id;
}

// -- Exports ------------------------------------------------------------------

export {
  restoreOpenProject,
  openProject,
  createProject,
  startSongInNewProject,
  reloadOpenProject,
  deleteProject,
  closeAndClearAllProjects,
  forkOpenProject,
};
