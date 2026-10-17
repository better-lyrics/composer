import { downloadJson, localDateStamp, sanitizeFileName } from "@/lib/download-file";
import type { SavedProject } from "@/lib/saved-project";

// -- Types --------------------------------------------------------------------

interface ProjectFile extends SavedProject {
  projectId?: string;
}

// -- Constants ----------------------------------------------------------------

const PROJECT_FILE_SUFFIX = ".ttml-project.json";

// -- Building -----------------------------------------------------------------

function projectFileFrom(projectId: string | undefined, project: SavedProject): ProjectFile {
  // primingStripped ships with the file: re-importing it must never re-shift already-corrected LAME priming timings.
  const { currentStem: _stem, hasUnexportedImport: _import, ...portable } = project;
  return projectId ? { ...portable, projectId } : portable;
}

function projectFileName(title: string, date: Date): string {
  return `${sanitizeFileName(title, "project")}-${localDateStamp(date)}${PROJECT_FILE_SUFFIX}`;
}

function downloadProjectFile(file: ProjectFile, filename = projectFileName(file.metadata.title, new Date())): void {
  downloadJson(file, filename);
}

// -- Exports ------------------------------------------------------------------

export { projectFileFrom, projectFileName, downloadProjectFile };
export type { ProjectFile };
