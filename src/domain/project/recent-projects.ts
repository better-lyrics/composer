import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { byMostRecentlyEdited } from "@/domain/project/library-order";
import { normalizeProjectQuery, projectMatchesQuery } from "@/domain/project/search";

// -- Types --------------------------------------------------------------------

interface RecentProjectsOptions {
  excludeId: string | undefined;
  query: string;
  limit: number;
}

// -- Derivations --------------------------------------------------------------

function recentProjects(entries: readonly ProjectIndexEntry[], options: RecentProjectsOptions): ProjectIndexEntry[] {
  const needle = normalizeProjectQuery(options.query);
  return entries
    .filter((entry) => entry.id !== options.excludeId && projectMatchesQuery(entry, needle))
    .toSorted(byMostRecentlyEdited)
    .slice(0, options.limit);
}

// -- Exports ------------------------------------------------------------------

export { recentProjects };
