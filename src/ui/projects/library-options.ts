import { IconLayoutGrid, IconList } from "@tabler/icons-react";
import { LIBRARY_SORTS, type LibrarySort } from "@/domain/project/library-order";
import type { LaunchScreen, LibraryView } from "@/domain/project/library-preferences";
import type { LibraryFilter, LibraryOrder } from "@/domain/project/library-view";
import { UNISON_SORTS, type UnisonSort } from "@/domain/unison/library-sort";
import type { SegmentedOption } from "@/ui/segmented-control";

// -- Labels -------------------------------------------------------------------

const LIBRARY_SORT_LABELS: Record<LibrarySort, string> = {
  edited: "Last edited",
  title: "Title",
  artist: "Artist",
  progress: "Progress",
};

const UNISON_SORT_LABELS: Record<UnisonSort, string> = {
  "unison-score": "Highest score",
  "unison-changed": "Recently went live",
  "unison-sent": "Recently shared",
};

const LIBRARY_ORDER_LABELS: Record<LibraryOrder, string> = { ...LIBRARY_SORT_LABELS, ...UNISON_SORT_LABELS };

const LIBRARY_FILTER_LABELS: Record<LibraryFilter, string> = {
  all: "All",
  "not-synced": "Not synced",
  syncing: "Syncing",
  synced: "Synced",
  unison: "On Unison",
};

// -- Options ------------------------------------------------------------------

const LIBRARY_SORT_OPTIONS: { value: LibrarySort; label: string }[] = LIBRARY_SORTS.map((sort) => ({
  value: sort,
  label: LIBRARY_SORT_LABELS[sort],
}));

const LIBRARY_ORDER_OPTIONS_WITH_UNISON: { value: LibraryOrder; label: string }[] = [
  ...LIBRARY_SORT_OPTIONS.map((option) => ({ ...option, group: "Project" })),
  ...UNISON_SORTS.map((sort) => ({ value: sort, label: UNISON_SORT_LABELS[sort], group: "Unison" })),
];

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
  LAUNCH_SCREEN_OPTIONS,
  LIBRARY_FILTER_LABELS,
  LIBRARY_ORDER_LABELS,
  LIBRARY_ORDER_OPTIONS_WITH_UNISON,
  LIBRARY_SORT_OPTIONS,
  LIBRARY_VIEW_OPTIONS,
  LIBRARY_VIEW_TOGGLE_OPTIONS,
};
