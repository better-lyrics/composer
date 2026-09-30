import { DEFAULT_SYLLABLE_SPLIT_DEFAULTS } from "@/domain/project/syllable-split-defaults";
import { PROJECT_BUNDLE_FORMAT } from "@/lib/project-bundle";
import type { ProjectFile } from "@/lib/project-file";
import { SAVED_PROJECT_VERSION, type SavedProject, upgradeSavedProject } from "@/lib/saved-project";

// -- Types --------------------------------------------------------------------

type ProjectFileContents =
  | { kind: "project"; project: ProjectFile }
  | { kind: "bundle"; projects: ProjectFile[]; unreadable: number };

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[ProjectFileRead]";
const PROJECT_FILE_ACCEPT = ".json,.ttml-project.json";
const SUPPORTED_VERSIONS: readonly number[] = Array.from({ length: SAVED_PROJECT_VERSION }, (_, index) => index + 1);

// -- Parsing ------------------------------------------------------------------

function isProjectFileName(name: string): boolean {
  const lowered = name.toLowerCase();
  return PROJECT_FILE_ACCEPT.split(",").some((extension) => lowered.endsWith(extension));
}

function isProjectFilePayload(value: unknown): value is SavedProject & { projectId?: unknown } {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value) && "lines" in value && "metadata" in value
  );
}

function isProjectBundlePayload(value: unknown): value is { projects: unknown[] } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { format?: unknown; projects?: unknown };
  return candidate.format === PROJECT_BUNDLE_FORMAT && Array.isArray(candidate.projects);
}

function parseProjectFile(parsed: unknown): ProjectFile {
  if (!isProjectFilePayload(parsed)) throw new Error("Not a Composer project file");
  const { projectId, ...project } = parsed;
  if (!SUPPORTED_VERSIONS.includes(project.version)) {
    throw new Error(`Unsupported project version: ${project.version}`);
  }
  if (!project.syllableSplitDefaults) project.syllableSplitDefaults = DEFAULT_SYLLABLE_SPLIT_DEFAULTS;
  upgradeSavedProject(project);
  return typeof projectId === "string" && projectId !== "" ? { ...project, projectId } : project;
}

function parseBundle(projects: readonly unknown[]): ProjectFileContents {
  const readable: ProjectFile[] = [];
  let unreadable = 0;
  for (const item of projects) {
    try {
      readable.push(parseProjectFile(item));
    } catch (error) {
      unreadable += 1;
      console.warn(LOG_PREFIX, "skipped a project the backup could not read", error);
    }
  }
  return { kind: "bundle", projects: readable, unreadable };
}

// -- Reading ------------------------------------------------------------------

function parseProjectFileContents(text: string): ProjectFileContents {
  const parsed: unknown = JSON.parse(text);
  if (isProjectBundlePayload(parsed)) return parseBundle(parsed.projects);
  return { kind: "project", project: parseProjectFile(parsed) };
}

async function readProjectFile(file: File): Promise<ProjectFile> {
  return parseProjectFile(JSON.parse(await file.text()));
}

function savedProjectFromFile(file: ProjectFile, savedAt: number): SavedProject {
  const { projectId: _projectId, ...project } = file;
  return { ...project, version: SAVED_PROJECT_VERSION, savedAt, hasUnexportedImport: true };
}

// -- Exports ------------------------------------------------------------------

export { PROJECT_FILE_ACCEPT, isProjectFileName, parseProjectFileContents, readProjectFile, savedProjectFromFile };
export type { ProjectFileContents };
