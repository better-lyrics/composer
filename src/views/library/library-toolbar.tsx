import { type LibrarySort, isLibrarySort } from "@/domain/project/library-order";
import type { LibraryView } from "@/domain/project/library-preferences";
import { LIBRARY_FILTERS, type LibraryFilter } from "@/domain/project/library-view";
import { getEffectiveKeysArray, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { Button } from "@/ui/button";
import { IconField } from "@/ui/icon-field";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import {
  LIBRARY_FILTER_LABELS,
  LIBRARY_SORT_LABELS,
  LIBRARY_SORT_OPTIONS,
  LIBRARY_VIEW_TOGGLE_OPTIONS,
} from "@/ui/projects/library-options";
import { SegmentedControl } from "@/ui/segmented-control";
import { Select } from "@/ui/select";
import { formatShortcut } from "@/utils/format-key";
import { IconArrowsSort, IconSearch } from "@tabler/icons-react";
import { useMemo } from "react";

// -- Types --------------------------------------------------------------------

interface LibraryToolbarProps {
  count: number;
  filter: LibraryFilter;
  counts: Record<LibraryFilter, number>;
  onFilterChange: (filter: LibraryFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
  searchRef: React.Ref<HTMLInputElement>;
  sort: LibrarySort;
  onSortChange: (sort: LibrarySort) => void;
  view: LibraryView;
  onViewChange: (view: LibraryView) => void;
}

// -- Constants ----------------------------------------------------------------

const SEARCH_SHORTCUT_ID = "library.focusSearch";

// -- Component ----------------------------------------------------------------

const LibraryToolbar: React.FC<LibraryToolbarProps> = ({
  count,
  filter,
  counts,
  onFilterChange,
  query,
  onQueryChange,
  searchRef,
  sort,
  onSortChange,
  view,
  onViewChange,
}) => {
  const searchShortcut = useShortcutBindingsStore(() => formatShortcut(getEffectiveKeysArray(SEARCH_SHORTCUT_ID)));
  const filterOptions = useMemo(
    () => LIBRARY_FILTERS.map((value) => ({ value, label: LIBRARY_FILTER_LABELS[value], count: counts[value] })),
    [counts],
  );
  const sortLabel = LIBRARY_SORT_LABELS[sort];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <h1 className="flex items-baseline gap-1.5 mr-1 text-lg font-bold">
        Projects <span className="text-sm font-medium text-composer-text-muted tabular-nums">{count}</span>
      </h1>
      <SegmentedControl
        aria-label="Filter by progress"
        value={filter}
        options={filterOptions}
        onChange={onFilterChange}
      />
      <div className="flex flex-[1_1_420px] items-center justify-end gap-3 min-w-0">
        <IconField
          ref={searchRef}
          icon={IconSearch}
          aria-label="Search projects"
          placeholder="Search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          wrapperClassName="flex-[0_1_260px] min-w-35"
          trailing={searchShortcut ? <InlineKeyBadge text={searchShortcut} /> : undefined}
        />
        <Select
          aria-label="Sort projects"
          value={sort}
          onChange={(next) => {
            if (isLibrarySort(next)) onSortChange(next);
          }}
          options={LIBRARY_SORT_OPTIONS}
          trigger={
            <Button
              variant="secondary"
              hasIcon
              aria-label={`Sort: ${sortLabel}`}
              className="shrink-0 whitespace-nowrap"
            >
              <IconArrowsSort aria-hidden="true" className="size-4" />
              {sortLabel}
            </Button>
          }
        />
        <SegmentedControl
          aria-label="View"
          value={view}
          options={LIBRARY_VIEW_TOGGLE_OPTIONS}
          onChange={onViewChange}
          className="shrink-0"
        />
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { LibraryToolbar };
