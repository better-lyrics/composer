import { displayTitle } from "@/domain/project/display-title";
import { compareIds } from "@/domain/project/id-order";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { syncedPercent } from "@/domain/project/progress";

// -- Types --------------------------------------------------------------------

type LibrarySort = "edited" | "title" | "artist" | "progress";
type ProjectComparator = (a: ProjectIndexEntry, b: ProjectIndexEntry) => number;

// -- Constants ----------------------------------------------------------------

const LIBRARY_SORTS: readonly LibrarySort[] = ["edited", "title", "artist", "progress"];
const TEXT_ORDER: Intl.CollatorOptions = { sensitivity: "base", numeric: true };
const collator = new Intl.Collator(undefined, TEXT_ORDER);

// -- Comparators --------------------------------------------------------------

function byMostRecentlyEdited(a: ProjectIndexEntry, b: ProjectIndexEntry): number {
  return b.updatedAt - a.updatedAt || compareIds(a.id, b.id);
}

function byTitle(a: ProjectIndexEntry, b: ProjectIndexEntry): number {
  return collator.compare(displayTitle(a.title), displayTitle(b.title)) || byMostRecentlyEdited(a, b);
}

function byArtist(a: ProjectIndexEntry, b: ProjectIndexEntry): number {
  const artistA = a.artists.join(", ");
  const artistB = b.artists.join(", ");
  if (!artistA !== !artistB) return artistA ? -1 : 1;
  return collator.compare(artistA, artistB) || byMostRecentlyEdited(a, b);
}

function byProgress(a: ProjectIndexEntry, b: ProjectIndexEntry): number {
  return syncedPercent(a) - syncedPercent(b) || byMostRecentlyEdited(a, b);
}

const COMPARATORS: Record<LibrarySort, ProjectComparator> = {
  edited: byMostRecentlyEdited,
  title: byTitle,
  artist: byArtist,
  progress: byProgress,
};

// -- Public API ---------------------------------------------------------------

function compareProjects(sort: LibrarySort): ProjectComparator {
  return COMPARATORS[sort];
}

function isLibrarySort(value: unknown): value is LibrarySort {
  return typeof value === "string" && (LIBRARY_SORTS as readonly string[]).includes(value);
}

// -- Exports ------------------------------------------------------------------

export { LIBRARY_SORTS, byMostRecentlyEdited, compareProjects, isLibrarySort };
export type { LibrarySort };
