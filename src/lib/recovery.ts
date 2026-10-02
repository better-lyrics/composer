import { displayTitle } from "@/domain/project/display-title";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { byMostRecentlyEdited } from "@/domain/project/library-order";
import { PROJECT_INDEX_STORE_NAME, PROJECT_STORE_NAME, getAllFromStore, getFromStore } from "@/lib/persistence-idb";
import { buildProjectBundle, downloadProjectBundle } from "@/lib/project-bundle";
import { downloadProjectFile, projectFileFrom, projectFileName } from "@/lib/project-file";
import { LEGACY_PROJECT_KEY, clearAllProjects, getOpenProjectId, loadProjectRecord } from "@/lib/project-storage";
import type { SavedProject } from "@/lib/saved-project";

// -- Types --------------------------------------------------------------------

interface RecoveredProject {
  version?: number;
  savedAt?: number;
  metadata?: { title?: string };
  lines?: unknown[];
}

interface StoredRecovery {
  projectId: string | undefined;
  project: SavedProject;
}

interface RecoveryResult {
  found: boolean;
  filename: string;
  lineCount: number;
  savedAt: number | undefined;
  title: string;
}

interface RecoverableProject {
  key: string;
  title: string;
  lineCount: number;
  savedAt: number | undefined;
}

interface RecoverySnapshot {
  entries: ProjectIndexEntry[];
  legacyProject: SavedProject | undefined;
}

// -- Constants ----------------------------------------------------------------

const LEGACY_RECOVERY_KEY = "legacy";

const NOT_FOUND_RESULT: RecoveryResult = {
  found: false,
  filename: "",
  lineCount: 0,
  savedAt: undefined,
  title: "",
};

// -- Reading ------------------------------------------------------------------

function legacyIndexEntry(project: SavedProject): ProjectIndexEntry {
  return {
    id: LEGACY_RECOVERY_KEY,
    title: project.metadata?.title ?? "",
    artists: project.metadata?.artists ?? [],
    album: project.metadata?.album ?? "",
    lineCount: project.lines?.length ?? 0,
    syncedLineCount: 0,
    hasWordTiming: false,
    audioKind: "none",
    storedAudioBytes: 0,
    updatedAt: project.savedAt,
  };
}

function readLegacyProject(): Promise<SavedProject | undefined> {
  return getFromStore<SavedProject>(PROJECT_STORE_NAME, LEGACY_PROJECT_KEY);
}

async function readRecoverySnapshot(): Promise<RecoverySnapshot> {
  const [realEntries, legacyProject] = await Promise.all([
    getAllFromStore<ProjectIndexEntry>(PROJECT_INDEX_STORE_NAME),
    readLegacyProject(),
  ]);
  const ordered = realEntries.toSorted(byMostRecentlyEdited);
  const entries = legacyProject ? [...ordered, legacyIndexEntry(legacyProject)] : ordered;
  return { entries, legacyProject };
}

async function loadStoredRecovery(
  key: string,
  legacyProject: SavedProject | undefined,
): Promise<StoredRecovery | undefined> {
  if (key === LEGACY_RECOVERY_KEY) {
    return legacyProject ? { projectId: undefined, project: legacyProject } : undefined;
  }
  const project = await loadProjectRecord(key);
  return project ? { projectId: key, project } : undefined;
}

async function readProjectFromIDB(): Promise<StoredRecovery | undefined> {
  const openId = await getOpenProjectId();
  const open = openId ? await loadProjectRecord(openId) : undefined;
  if (open) return { projectId: openId, project: open };
  const { entries, legacyProject } = await readRecoverySnapshot();
  const first = entries[0];
  return first ? loadStoredRecovery(first.id, legacyProject) : undefined;
}

function buildRecoveryResult(project: RecoveredProject): RecoveryResult {
  const title = displayTitle(project.metadata?.title?.trim() ?? "");
  return {
    found: true,
    filename: projectFileName(title, new Date()),
    lineCount: project.lines?.length ?? 0,
    savedAt: project.savedAt,
    title,
  };
}

function toRecoverableProject(entry: ProjectIndexEntry): RecoverableProject {
  return { key: entry.id, title: displayTitle(entry.title), lineCount: entry.lineCount, savedAt: entry.updatedAt };
}

function downloadStored(stored: StoredRecovery): RecoveryResult {
  const result = buildRecoveryResult(stored.project);
  downloadProjectFile(projectFileFrom(stored.projectId, stored.project), result.filename);
  return result;
}

// -- Public API ---------------------------------------------------------------

async function readRecoveryMetadata(): Promise<RecoveryResult> {
  const stored = await readProjectFromIDB();
  return stored ? buildRecoveryResult(stored.project) : NOT_FOUND_RESULT;
}

async function downloadRecoveryFile(): Promise<RecoveryResult> {
  const stored = await readProjectFromIDB();
  return stored ? downloadStored(stored) : NOT_FOUND_RESULT;
}

async function listRecoverableProjects(): Promise<RecoverableProject[]> {
  const { entries } = await readRecoverySnapshot();
  return entries.map(toRecoverableProject);
}

async function downloadRecoverableProject(key: string): Promise<RecoveryResult> {
  const legacyProject = key === LEGACY_RECOVERY_KEY ? await readLegacyProject() : undefined;
  const stored = await loadStoredRecovery(key, legacyProject);
  return stored ? downloadStored(stored) : NOT_FOUND_RESULT;
}

async function downloadAllRecoverableProjects(): Promise<number> {
  const { entries, legacyProject } = await readRecoverySnapshot();
  if (entries.length === 0) return 0;
  const stored = (await Promise.all(entries.map((entry) => loadStoredRecovery(entry.id, legacyProject)))).filter(
    (candidate): candidate is StoredRecovery => candidate !== undefined,
  );
  if (stored.length === 0) return 0;
  const sources = stored.map(({ projectId, project }) => ({ id: projectId, project }));
  downloadProjectBundle(buildProjectBundle(sources, Date.now()));
  return stored.length;
}

function clearRecoveryStorage(): Promise<void> {
  return clearAllProjects();
}

// -- Exports ------------------------------------------------------------------

export {
  readRecoveryMetadata,
  downloadRecoveryFile,
  listRecoverableProjects,
  downloadRecoverableProject,
  downloadAllRecoverableProjects,
  clearRecoveryStorage,
  buildRecoveryResult,
  NOT_FOUND_RESULT,
};
export type { RecoveredProject, RecoveryResult, RecoverableProject };
