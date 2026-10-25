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
import { IconArrowsSort, IconChevronDown, IconSearch } from "@tabler/icons-react";
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-3">
      <h1 className="flex items-baseline gap-2 mr-2 text-xl font-bold tracking-[-0.01em]">
        Projects <span className="text-[15px] font-medium text-(--muted) tabular-nums">{count}</span>
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
          className="h-9 rounded-[10px]"
          trailing={
            searchShortcut ? (
              <span className="flex text-(--muted) *:ml-0">
                <InlineKeyBadge keys={getEffectiveKeysArray(SEARCH_SHORTCUT_ID)} />
              </span>
            ) : undefined
          }
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
              size="lg"
              hasIcon
              aria-label={`Sort: ${sortLabel}`}
              className="shrink-0 whitespace-nowrap pr-[5px] aria-expanded:[background:var(--layer-3)] aria-expanded:text-composer-text"
            >
              <IconArrowsSort aria-hidden="true" className="size-4" />
              {sortLabel}
              <IconChevronDown
                aria-hidden="true"
                className="size-3.5 opacity-50 transition-[rotate,opacity] in-aria-expanded:rotate-180 in-aria-expanded:opacity-90"
              />
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
