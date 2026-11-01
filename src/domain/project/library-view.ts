import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { type LibrarySort, byMostRecentlyEdited, compareProjects } from "@/domain/project/library-order";
import { type ProjectStage, projectStage } from "@/domain/project/progress";
import { normalizeProjectQuery, projectMatchesQuery } from "@/domain/project/search";

// -- Types --------------------------------------------------------------------

type LibraryFilter = "all" | ProjectStage;

interface LibraryViewOptions {
  filter: LibraryFilter;
  query: string;
  sort: LibrarySort;
}

// -- Constants ----------------------------------------------------------------

const LIBRARY_FILTERS: readonly LibraryFilter[] = ["all", "not-synced", "syncing", "synced"];

// -- Derivations --------------------------------------------------------------

function matchesFilter(entry: ProjectIndexEntry, filter: LibraryFilter): boolean {
  return filter === "all" || projectStage(entry) === filter;
}

function libraryProjects(entries: readonly ProjectIndexEntry[], options: LibraryViewOptions): ProjectIndexEntry[] {
  const needle = normalizeProjectQuery(options.query);
  return entries
    .filter((entry) => matchesFilter(entry, options.filter) && projectMatchesQuery(entry, needle))
    .toSorted(compareProjects(options.sort));
}

function filterCounts(entries: readonly ProjectIndexEntry[]): Record<LibraryFilter, number> {
  const counts: Record<LibraryFilter, number> = { all: 0, "not-synced": 0, syncing: 0, synced: 0 };
  for (const entry of entries) {
    counts.all += 1;
    counts[projectStage(entry)] += 1;
  }
  return counts;
}

function resumeProject(entries: readonly ProjectIndexEntry[]): ProjectIndexEntry | undefined {
  let latest: ProjectIndexEntry | undefined;
  for (const entry of entries) {
    if (!latest || byMostRecentlyEdited(entry, latest) < 0) latest = entry;
  }
  return latest;
}

// -- Exports ------------------------------------------------------------------

export { LIBRARY_FILTERS, filterCounts, libraryProjects, resumeProject };
export type { LibraryFilter };
