import { LIBRARY_SORTS, type LibrarySort } from "@/domain/project/library-order";
import type { LibraryFilter } from "@/domain/project/library-view";
import type { LaunchScreen, LibraryView } from "@/domain/project/library-preferences";
import type { SegmentedOption } from "@/ui/segmented-control";
import { IconLayoutGrid, IconList } from "@tabler/icons-react";

// -- Labels -------------------------------------------------------------------

const LIBRARY_SORT_LABELS: Record<LibrarySort, string> = {
  edited: "Last edited",
  title: "Title",
  artist: "Artist",
  progress: "Progress",
};

const LIBRARY_FILTER_LABELS: Record<LibraryFilter, string> = {
  all: "All",
  "not-synced": "Not synced",
  syncing: "Syncing",
  synced: "Synced",
};

// -- Options ------------------------------------------------------------------

const LIBRARY_SORT_OPTIONS: { value: LibrarySort; label: string }[] = LIBRARY_SORTS.map((sort) => ({
  value: sort,
  label: LIBRARY_SORT_LABELS[sort],
}));

const LIBRARY_VIEW_OPTIONS: readonly SegmentedOption<LibraryView>[] = [
  { value: "list", label: "List", icon: IconList },
  { value: "grid", label: "Grid", icon: IconLayoutGrid },
];

const LIBRARY_VIEW_TOGGLE_OPTIONS: readonly SegmentedOption<LibraryView>[] = [
  { value: "list", label: "List view", icon: IconList, iconOnly: true },
  { value: "grid", label: "Grid view", icon: IconLayoutGrid, iconOnly: true },
];

const LAUNCH_SCREEN_OPTIONS: { value: LaunchScreen; label: string }[] = [
  { value: "projects", label: "Show Projects" },
  { value: "last-project", label: "Reopen last project" },
];

// -- Exports ------------------------------------------------------------------

export {
  LIBRARY_SORT_LABELS,
  LIBRARY_SORT_OPTIONS,
  LIBRARY_FILTER_LABELS,
  LIBRARY_VIEW_OPTIONS,
  LIBRARY_VIEW_TOGGLE_OPTIONS,
  LAUNCH_SCREEN_OPTIONS,
};
