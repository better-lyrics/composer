import { type ProjectIndexEntry, buildIndexEntry } from "@/domain/project/index-entry";
import { byMostRecentlyEdited } from "@/domain/project/library-order";
import { createProject, openProject, reloadOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { hiddenProjectIdsSnapshot } from "@/lib/pending-deletions";
import { flushPendingSave } from "@/lib/persistence-debounce";
import type { ProjectFile } from "@/lib/project-file";
import { type ProjectFileContents, parseProjectFileContents, savedProjectFromFile } from "@/lib/project-file-read";
import {
  createProjectId,
  listProjectIndex,
  restoreDeletedProjectRecord,
  saveProjectRecord,
  updateProjectRecord,
} from "@/lib/project-repository";
import { ProjectDeletedError } from "@/lib/project-tombstones";
import { reportStorageWriteError } from "@/lib/storage-signals";
import { useProjectStore } from "@/stores/project";
import { askImportConflict } from "@/ui/projects/import-conflict-choice";
import { detectFileType } from "@/utils/lyrics-parsers/detect";
import { skippedLinesMessage } from "@/utils/lyrics-parsers/shared";
import { formatProjectCount } from "@/utils/project-count";
import { readTtmlLyrics, replaceWithTtmlLyrics } from "@/views/lyrics-import-modal/import-lyrics";
import type { ChangeEvent } from "react";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

type ImportConflictReason = "same-project" | "same-video";

interface ImportConflict {
  file: ProjectFile;
  existing: ProjectIndexEntry;
  reason: ImportConflictReason;
}

interface ProjectFileSummary {
  savedAt: number;
  lineCount: number;
  syncedLineCount: number;
}

interface BundleRestore {
  restored: number;
  alreadyInLibrary: number;
  unreadable: number;
  failed: number;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[ProjectImport]";

// -- Matching -----------------------------------------------------------------

function findImportConflict(file: ProjectFile, entries: readonly ProjectIndexEntry[]): ImportConflict | undefined {
  const sameProject = file.projectId ? entries.find((entry) => entry.id === file.projectId) : undefined;
  if (sameProject) return { file, existing: sameProject, reason: "same-project" };
  const videoId = file.audioSource?.kind === "youtube" ? file.audioSource.videoId : undefined;
  if (!videoId) return undefined;
  const sameVideo = entries.filter((entry) => entry.videoId === videoId).toSorted(byMostRecentlyEdited)[0];
  return sameVideo ? { file, existing: sameVideo, reason: "same-video" } : undefined;
}

function projectFileSummary(file: ProjectFile): ProjectFileSummary {
  const entry = buildIndexEntry({
    id: file.projectId ?? "",
    metadata: file.metadata,
    lines: file.lines,
    audioSource: file.audioSource,
    storedAudioBytes: 0,
    updatedAt: file.savedAt,
  });
  return { savedAt: file.savedAt, lineCount: entry.lineCount, syncedLineCount: entry.syncedLineCount };
}

// -- Writing ------------------------------------------------------------------

async function importProjectAsNew(file: ProjectFile): Promise<string> {
  const id = createProjectId();
  await saveProjectRecord(id, savedProjectFromFile(file, Date.now()));
  return id;
}

async function replaceProjectFromFile(id: string, file: ProjectFile): Promise<void> {
  const replacesOpenProject = id === openProjectIdSnapshot();
  if (replacesOpenProject) await flushPendingSave();
  await updateProjectRecord(id, (existing) => ({
    ...savedProjectFromFile(file, Date.now()),
    audioSource: existing.audioSource ?? file.audioSource,
    audioFileName: existing.audioFileName ?? file.audioFileName,
    currentStem: existing.currentStem,
    primingStripped: existing.primingStripped,
  }));
  if (replacesOpenProject) await reloadOpenProject();
}

async function liveEntries(): Promise<ProjectIndexEntry[]> {
  const hidden = hiddenProjectIdsSnapshot();
  return (await listProjectIndex()).filter((entry) => !hidden.has(entry.id));
}

// -- Backups ------------------------------------------------------------------

async function restoreBundledProject(file: ProjectFile, pendingIds: ReadonlySet<string>): Promise<void> {
  const record = savedProjectFromFile(file, Number.isFinite(file.savedAt) ? file.savedAt : Date.now());
  if (file.projectId && !pendingIds.has(file.projectId)) {
    try {
      await saveProjectRecord(file.projectId, record);
    } catch (error) {
      if (!(error instanceof ProjectDeletedError)) throw error;
      await restoreDeletedProjectRecord(file.projectId, record);
    }
    return;
  }
  await saveProjectRecord(createProjectId(), record);
}

function dedupeBundleProjects(projects: readonly ProjectFile[]): { unique: ProjectFile[]; duplicates: number } {
  const seenIds = new Set<string>();
  const unique: ProjectFile[] = [];
  let duplicates = 0;
  for (const project of projects) {
    const id = project.projectId;
    if (id && seenIds.has(id)) {
      duplicates += 1;
      continue;
    }
    if (id) seenIds.add(id);
    unique.push(project);
  }
  return { unique, duplicates };
}

async function restoreProjectBundle(projects: readonly ProjectFile[], unreadable: number): Promise<BundleRestore> {
  const { unique, duplicates } = dedupeBundleProjects(projects);
  const hidden = hiddenProjectIdsSnapshot();
  const storedIds = new Set((await listProjectIndex()).map((entry) => entry.id));
  const toRestore = unique.filter((project) => {
    const id = project.projectId;
    return !(id && storedIds.has(id) && !hidden.has(id));
  });
  const outcomes = await Promise.allSettled(toRestore.map((project) => restoreBundledProject(project, hidden)));
  const failures = outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []));
  for (const error of failures) {
    console.error(LOG_PREFIX, "could not restore a project from the backup", error);
    reportStorageWriteError(error);
  }
  const failed = failures.length;
  const restored = toRestore.length - failed;
  const alreadyInLibrary = duplicates + unique.length - toRestore.length;
  return { restored, alreadyInLibrary, unreadable, failed };
}

function bundleRestoreDetails(result: BundleRestore): string {
  return [
    result.alreadyInLibrary > 0 ? `${formatProjectCount(result.alreadyInLibrary)} already in your library.` : "",
    result.unreadable > 0 ? `${formatProjectCount(result.unreadable)} couldn't be read.` : "",
    result.failed > 0 ? `${formatProjectCount(result.failed)} couldn't be saved.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function showBundleRestoreToast(result: BundleRestore): void {
  const { restored, alreadyInLibrary, unreadable, failed } = result;
  if (restored === 0 && alreadyInLibrary > 0 && unreadable === 0 && failed === 0) {
    toast("Every project in this backup is already in your library");
    return;
  }
  if (restored === 0 && alreadyInLibrary === 0 && failed === 0) {
    toast.error("Couldn't read any project in that backup");
    return;
  }
  const details = bundleRestoreDetails(result);
  if (restored === 0) {
    toast.error("Couldn't restore that backup", details ? { description: details } : undefined);
    return;
  }
  toast.success(`Restored ${formatProjectCount(restored)}`, details ? { description: details } : undefined);
}

// -- Flow ---------------------------------------------------------------------

function openTtmlAsNewProject(content: string, fileName: string): string | null {
  const read = readTtmlLyrics(content, fileName, 0);
  if (read.status === "unreadable") {
    toast.error(read.message);
    return null;
  }
  const id = createProject();
  const skipped = replaceWithTtmlLyrics(read.parsed);
  useProjectStore.getState().clearHistory();
  toast(`Opened ${fileName} as a new project from its TTML`);
  if (skipped > 0) toast.warning(skippedLinesMessage(skipped));
  return id;
}

function reportUnreadableProjectFile(error: unknown): null {
  console.error(LOG_PREFIX, "could not read the project file", error);
  toast.error("Couldn't read that project file");
  return null;
}

async function importProjectFile(file: File): Promise<string | null> {
  let text: string;
  try {
    text = await file.text();
  } catch (error) {
    return reportUnreadableProjectFile(error);
  }
  let contents: ProjectFileContents;
  try {
    contents = parseProjectFileContents(text);
  } catch (error) {
    if (error instanceof SyntaxError && detectFileType("", text) === "ttml")
      return openTtmlAsNewProject(text, file.name);
    return reportUnreadableProjectFile(error);
  }
  return importProjectContents(contents);
}

async function importProjectContents(contents: ProjectFileContents): Promise<string | null> {
  if (contents.kind === "bundle") {
    try {
      showBundleRestoreToast(await restoreProjectBundle(contents.projects, contents.unreadable));
    } catch (error) {
      console.error(LOG_PREFIX, "could not restore the backup", error);
      toast.error("Couldn't restore that backup");
    }
    return null;
  }
  const projectFile = contents.project;
  try {
    const conflict = findImportConflict(projectFile, await liveEntries());
    const choice = conflict ? await askImportConflict(conflict, projectFileSummary(conflict.file)) : "keep-both";
    if (choice === "cancel") return null;
    let id: string;
    if (choice === "replace" && conflict) {
      try {
        id = conflict.existing.id;
        await replaceProjectFromFile(id, projectFile);
      } catch (error) {
        if (!(error instanceof ProjectDeletedError)) throw error;
        console.warn(LOG_PREFIX, "the project to replace no longer exists; importing as a new project instead", error);
        id = await importProjectAsNew(projectFile);
      }
    } else {
      id = await importProjectAsNew(projectFile);
    }
    await openProject(id);
    return id;
  } catch (error) {
    console.error(LOG_PREFIX, "could not import the project file", error);
    toast.error("Couldn't import that project");
    return null;
  }
}

// -- Input wiring -------------------------------------------------------------

async function importProjectFromInput(event: ChangeEvent<HTMLInputElement>): Promise<string | null> {
  const file = event.target.files?.[0];
  event.target.value = "";
  return file ? importProjectFile(file) : null;
}

// -- Exports ------------------------------------------------------------------

export {
  findImportConflict,
  projectFileSummary,
  replaceProjectFromFile,
  restoreProjectBundle,
  showBundleRestoreToast,
  importProjectContents,
  importProjectFile,
  importProjectFromInput,
  reportUnreadableProjectFile,
};
export type { ImportConflict, BundleRestore, ProjectFileSummary };
