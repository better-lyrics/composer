import { type ProjectTab, isProjectTab } from "@/domain/project/tab";
import { applySavedProject } from "@/lib/apply-saved-project";
import { stripLamePriming } from "@/lib/priming-migration";
import { loadProjectAudio } from "@/lib/project-audio";
import { loadProjectIndexEntry, saveProjectRecord } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { type SavedProject, upgradeSavedProject } from "@/lib/saved-project";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

interface RestorePayload {
  project: SavedProject | undefined;
  audio: File | undefined;
  lastTab: ProjectTab | undefined;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[ProjectRestore]";
const EMPTY_RESTORE: RestorePayload = { project: undefined, audio: undefined, lastTab: undefined };

// -- Module state -------------------------------------------------------------

let restoring = false;

// -- Loading ------------------------------------------------------------------

async function loadProjectForRestore(id: string): Promise<RestorePayload> {
  const [project, audio, entry] = await Promise.all([
    loadProjectRecord(id),
    loadProjectAudio(id),
    loadProjectIndexEntry(id),
  ]);
  if (project) {
    const upgraded = upgradeSavedProject(project);
    const primingStripped = await stripLamePriming(project, audio);
    if (upgraded || primingStripped) await saveProjectRecord(id, project);
  }
  return { project, audio, lastTab: isProjectTab(entry?.lastTab) ? entry.lastTab : undefined };
}

function hasStoredProject(payload: RestorePayload): boolean {
  return payload.project !== undefined;
}

function hasRestorableContent(payload: RestorePayload): boolean {
  return payload.project !== undefined || payload.audio !== undefined;
}

// -- Applying -----------------------------------------------------------------

function resetProjectScopedStores(): void {
  useProjectStore.getState().reset();
  useAudioStore.getState().setSource(null);
  useSeparationStore.getState().reset();
  useTimelineStore.getState().resetProjectScope();
}

function applyStoredProject(project: SavedProject, audio: File | undefined): void {
  // The stem goes first: useAutoSeparate keeps it only if it is set before the source changes.
  if (project.currentStem) useSeparationStore.getState().restoreCurrentStem(project.currentStem);

  const savedSource = project.audioSource;
  if (savedSource?.kind === "youtube" && audio) useAudioStore.getState().setYouTubeSource(savedSource.videoId, audio);
  else if (audio) useAudioStore.getState().setSource({ type: "file", file: audio });
  else if (savedSource) useAudioStore.getState().expectProjectAudio(savedSource);

  const issues = applySavedProject(project, "storage");
  if (issues.length === 0) return;
  console.warn(
    `${LOG_PREFIX} loaded project has malformed fields (${issues.join(", ")}); using safe defaults. The raw record is still in IndexedDB; visit /recover to download it.`,
  );
}

function applyProjectToStores(payload: RestorePayload): void {
  restoring = true;
  try {
    resetProjectScopedStores();
    if (payload.project) applyStoredProject(payload.project, payload.audio);
    else if (payload.audio) useAudioStore.getState().setSource({ type: "file", file: payload.audio });
    if (payload.lastTab) useProjectStore.getState().setActiveTab(payload.lastTab);
    useProjectStore.getState().markClean();
  } finally {
    restoring = false;
  }
}

function isRestoringProject(): boolean {
  return restoring;
}

// -- Exports ------------------------------------------------------------------

export {
  EMPTY_RESTORE,
  loadProjectForRestore,
  hasStoredProject,
  hasRestorableContent,
  applyProjectToStores,
  isRestoringProject,
};
export type { RestorePayload };
