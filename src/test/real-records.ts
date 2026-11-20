import { readFileSync } from "node:fs";
import { PROJECT_BUNDLE_FORMAT } from "@/lib/project-bundle";
import type { StoredProject } from "@/lib/saved-project";

// -- Types --------------------------------------------------------------------

interface RealRecord {
  name: string;
  record: StoredProject;
}

// -- Constants ----------------------------------------------------------------

// Newline-separated `.composer` paths, given only on the maintainer's machine.
const REAL_PROJECT_FILES = process.env.INSYNC_REAL_PROJECTS?.split("\n").filter(Boolean) ?? [];

// -- Reading ------------------------------------------------------------------

// The records exactly as the files hold them, before any upgrade.
function realStoredRecords(): RealRecord[] {
  return REAL_PROJECT_FILES.flatMap((path) => {
    const parsed: { format?: unknown; projects?: StoredProject[] } & StoredProject = JSON.parse(
      readFileSync(path, "utf8"),
    );
    const records = parsed.format === PROJECT_BUNDLE_FORMAT ? (parsed.projects ?? []) : [parsed];
    return records.map((record) => ({ name: `${path}: ${record.metadata.title}`, record }));
  });
}

// -- Exports ------------------------------------------------------------------

export { REAL_PROJECT_FILES, realStoredRecords };
