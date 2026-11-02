import type { ProjectIndexEntry } from "@/domain/project/index-entry";

// -- Derivations ---------------------------------------------------------------

function projectsByLyricId(entries: readonly ProjectIndexEntry[]): Map<string, ProjectIndexEntry> {
  return new Map(entries.flatMap((entry) => (entry.unisonLyricId ? [[entry.unisonLyricId, entry] as const] : [])));
}

// -- Exports -------------------------------------------------------------------

export { projectsByLyricId };
