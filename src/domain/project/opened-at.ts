import type { ProjectIndexEntry } from "@/domain/project/index-entry";

// -- Derivations --------------------------------------------------------------

function lastOpenedAt(entry: Pick<ProjectIndexEntry, "openedAt" | "updatedAt">): number {
  return entry.openedAt ?? entry.updatedAt;
}

// -- Exports ------------------------------------------------------------------

export { lastOpenedAt };
