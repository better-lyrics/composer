import { downloadJson, localDateStamp } from "@/lib/download-file";
import { type ProjectFile, projectFileFrom } from "@/lib/project-file";
import type { SavedProject } from "@/lib/saved-project";

// -- Constants ----------------------------------------------------------------

const PROJECT_BUNDLE_FORMAT = "composer-project-bundle";
const PROJECT_BUNDLE_VERSION = 1;
const PROJECT_BUNDLE_SUFFIX = ".ttml-projects.json";

// -- Types --------------------------------------------------------------------

interface ProjectBundle {
  format: typeof PROJECT_BUNDLE_FORMAT;
  version: typeof PROJECT_BUNDLE_VERSION;
  exportedAt: number;
  projects: ProjectFile[];
}

interface BundleSource {
  id: string | undefined;
  project: SavedProject;
}

// -- Building -----------------------------------------------------------------

function buildProjectBundle(sources: readonly BundleSource[], exportedAt: number): ProjectBundle {
  return {
    format: PROJECT_BUNDLE_FORMAT,
    version: PROJECT_BUNDLE_VERSION,
    exportedAt,
    projects: sources.map((source) => projectFileFrom(source.id, source.project)),
  };
}

function projectBundleFileName(date: Date): string {
  return `composer-backup-${localDateStamp(date)}${PROJECT_BUNDLE_SUFFIX}`;
}

function downloadProjectBundle(bundle: ProjectBundle): void {
  downloadJson(bundle, projectBundleFileName(new Date(bundle.exportedAt)));
}

// -- Exports ------------------------------------------------------------------

export { PROJECT_BUNDLE_FORMAT, buildProjectBundle, projectBundleFileName, downloadProjectBundle };
export type { ProjectBundle };
