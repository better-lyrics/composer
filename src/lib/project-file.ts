import { downloadJson, localDateStamp, sanitizeFileName } from "@/lib/download-file";
import type { SavedProject, StoredProject } from "@/lib/saved-project";

// -- Types --------------------------------------------------------------------

interface ProjectFile extends SavedProject {
  projectId?: string;
}

// A record as written to a file, in whichever format it was saved.
type StoredProjectFile = StoredProject & { projectId?: string };

// -- Constants ----------------------------------------------------------------

const PROJECT_FILE_SUFFIX = ".composer";

// -- Building -----------------------------------------------------------------

function projectFileFrom(projectId: string | undefined, project: StoredProject): StoredProjectFile {
  // The priming flags ship with the file: re-importing it must never re-shift already-corrected LAME priming timings.
  const { currentStem: _stem, hasUnexportedImport: _import, ...portable } = project;
  return projectId ? { ...portable, projectId } : portable;
}

function projectFileName(title: string, date: Date): string {
  return `${sanitizeFileName(title, "project")}-${localDateStamp(date)}${PROJECT_FILE_SUFFIX}`;
}

function downloadProjectFile(file: StoredProjectFile, filename = projectFileName(file.metadata.title, new Date())): void {
  downloadJson(file, filename);
}

// -- Exports ------------------------------------------------------------------

export { projectFileFrom, projectFileName, downloadProjectFile };
export type { ProjectFile, StoredProjectFile };
