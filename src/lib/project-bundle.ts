import { downloadJson, localDateStamp } from "@/lib/download-file";
import { type StoredProjectFile, projectFileFrom } from "@/lib/project-file";
import type { StoredProject } from "@/lib/saved-project";

// -- Constants ----------------------------------------------------------------

const PROJECT_BUNDLE_FORMAT = "composer-project-bundle";
const PROJECT_BUNDLE_VERSION = 1;
const PROJECT_BUNDLE_SUFFIX = ".composer";

// -- Types --------------------------------------------------------------------

interface ProjectBundle {
  format: typeof PROJECT_BUNDLE_FORMAT;
  version: typeof PROJECT_BUNDLE_VERSION;
  exportedAt: number;
  projects: StoredProjectFile[];
  previousVersions?: StoredProjectFile[];
}

interface BundleSource {
  id: string | undefined;
  project: StoredProject;
}

// -- Building -----------------------------------------------------------------

function toProjectFiles(sources: readonly BundleSource[]): StoredProjectFile[] {
  return sources.map((source) => projectFileFrom(source.id, source.project));
}

function buildProjectBundle(
  sources: readonly BundleSource[],
  exportedAt: number,
  previousVersions: readonly BundleSource[] = [],
): ProjectBundle {
  const bundle: ProjectBundle = {
    format: PROJECT_BUNDLE_FORMAT,
    version: PROJECT_BUNDLE_VERSION,
    exportedAt,
    projects: toProjectFiles(sources),
  };
  return previousVersions.length > 0 ? { ...bundle, previousVersions: toProjectFiles(previousVersions) } : bundle;
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
