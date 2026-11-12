import { displayTitle } from "@/domain/project/display-title";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { noteGuideSignal } from "@/lib/guide-signals";
import { createProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { schedulePendingDeletion } from "@/lib/pending-deletions";
import { cancelPendingSave, flushPendingSave, saveOpenProjectNow } from "@/lib/persistence-debounce";
import { loadProjectAudio } from "@/lib/project-audio";
import { copyProjectStems, loadProjectStems } from "@/lib/project-stems";
import { downloadProjectFile, projectFileFrom } from "@/lib/project-file";
import { createProjectId, saveProjectRecordWithAudio, updateProjectRecord } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import type { SavedProject } from "@/lib/saved-project";
import { useProjectStore } from "@/stores/project";
import { showDeletedProjectsToast } from "@/utils/project-toast";

// -- Types --------------------------------------------------------------------

type DeletableProject = Pick<ProjectIndexEntry, "id" | "title">;

// -- Helpers ------------------------------------------------------------------

async function latestRecord(id: string): Promise<SavedProject> {
  if (id === openProjectIdSnapshot()) await flushPendingSave();
  const record = await loadProjectRecord(id);
  if (!record) throw new Error(`Project ${id} is not stored in this browser`);
  return record;
}

function copyTitle(title: string): string {
  return `${displayTitle(title)} copy`;
}

// -- Actions ------------------------------------------------------------------

async function renameProject(id: string, title: string): Promise<void> {
  const nextTitle = title.trim();
  if (id === openProjectIdSnapshot()) {
    useProjectStore.getState().setMetadata({ title: nextTitle });
    await saveOpenProjectNow();
    return;
  }
  await updateProjectRecord(id, (project) => ({
    ...project,
    metadata: { ...project.metadata, title: nextTitle },
    savedAt: Date.now(),
  }));
}

async function duplicateProject(id: string): Promise<string> {
  const [record, audio, stems] = await Promise.all([latestRecord(id), loadProjectAudio(id), loadProjectStems(id)]);
  const { unisonLyricId: _unisonLyricId, ...copy } = record;
  const copyId = createProjectId();
  await saveProjectRecordWithAudio(
    copyId,
    { ...copy, metadata: { ...copy.metadata, title: copyTitle(copy.metadata.title) }, savedAt: Date.now() },
    audio,
  );
  if (stems) await copyProjectStems(copyId, stems);
  return copyId;
}

async function exportProjectFiles(ids: readonly string[]): Promise<void> {
  const records = await Promise.allSettled(ids.map((id) => latestRecord(id)));
  records.forEach((record, index) => {
    if (record.status === "fulfilled") downloadProjectFile(projectFileFrom(ids[index], record.value));
  });
  if (records.some((record) => record.status === "fulfilled")) noteGuideSignal("export.backup");
  const failure = records.find((record) => record.status === "rejected");
  if (failure) throw failure.reason;
}

function deleteProjectsWithUndo(projects: readonly DeletableProject[]): void {
  if (projects.length === 0) return;
  const deletion = schedulePendingDeletion(projects.map((project) => project.id));
  showDeletedProjectsToast(
    projects.map((project) => project.title),
    deletion,
  );
}

function deleteOpenProjectWithUndo(): "scheduled" | "cleared" {
  const id = openProjectIdSnapshot();
  if (!id) {
    cancelPendingSave();
    createProject();
    return "cleared";
  }
  deleteProjectsWithUndo([{ id, title: useProjectStore.getState().metadata.title }]);
  return "scheduled";
}

// -- Exports ------------------------------------------------------------------

export { renameProject, duplicateProject, exportProjectFiles, deleteProjectsWithUndo, deleteOpenProjectWithUndo };
export type { DeletableProject };
