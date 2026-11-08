import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { byMostRecentlyEdited, compareProjects, type LibrarySort } from "@/domain/project/library-order";
import { type ProjectStage, projectStage } from "@/domain/project/progress";
import { normalizeProjectQuery, projectMatchesQuery } from "@/domain/project/search";
import { compareByUnison, isUnisonSort, type UnisonSort, type UnisonStanding } from "@/domain/unison/library-sort";

// -- Types --------------------------------------------------------------------

type LibraryFilter = "all" | ProjectStage | "unison";

type LibraryOrder = LibrarySort | UnisonSort;

interface LibraryViewOptions {
  filter: LibraryFilter;
  query: string;
  sort: LibraryOrder;
  standings?: ReadonlyMap<string, UnisonStanding>;
}

// -- Constants ----------------------------------------------------------------

const LIBRARY_FILTERS: readonly LibraryFilter[] = ["all", "not-synced", "syncing", "synced", "unison"];

// -- Derivations --------------------------------------------------------------

function matchesFilter(entry: ProjectIndexEntry, filter: LibraryFilter): boolean {
  if (filter === "all") return true;
  if (filter === "unison") return entry.unisonLyricId !== undefined;
  return projectStage(entry) === filter;
}

// The Unison filter only exists while signed in to Unison.
function shownLibraryFilter(chosen: LibraryFilter, signedInToUnison: boolean): LibraryFilter {
  return chosen === "unison" && !signedInToUnison ? "all" : chosen;
}

// Unison sorts only exist while the Unison column shows.
function shownLibraryOrder(chosen: LibraryOrder, showUnison: boolean): LibraryOrder {
  return isUnisonSort(chosen) && !showUnison ? "edited" : chosen;
}

function libraryProjects(entries: readonly ProjectIndexEntry[], options: LibraryViewOptions): ProjectIndexEntry[] {
  const needle = normalizeProjectQuery(options.query);
  return entries
    .filter((entry) => matchesFilter(entry, options.filter) && projectMatchesQuery(entry, needle))
    .toSorted(
      isUnisonSort(options.sort)
        ? compareByUnison(options.sort, options.standings ?? new Map())
        : compareProjects(options.sort),
    );
}

function filterCounts(entries: readonly ProjectIndexEntry[]): Record<LibraryFilter, number> {
  const counts: Record<LibraryFilter, number> = { all: 0, "not-synced": 0, syncing: 0, synced: 0, unison: 0 };
  for (const entry of entries) {
    counts.all += 1;
    counts[projectStage(entry)] += 1;
    if (entry.unisonLyricId !== undefined) counts.unison += 1;
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

export type { LibraryFilter, LibraryOrder };
export { filterCounts, LIBRARY_FILTERS, libraryProjects, resumeProject, shownLibraryFilter, shownLibraryOrder };
