import { IconChevronDown, IconSortDescending } from "@tabler/icons-react";
import { MenuItem } from "@/ui/menu";
import { Popover } from "@/ui/popover";
import { cn } from "@/utils/cn";
import type { FilterChip, SortKey } from "@/utils/library/filter-sort";

// -- Interfaces ---------------------------------------------------------------

interface LibraryToolbarProps {
  filter: FilterChip;
  onFilterChange: (chip: FilterChip) => void;
  sort: SortKey;
  onSortChange: (key: SortKey) => void;
}

// -- Constants ----------------------------------------------------------------

const FILTERS: ReadonlyArray<{ chip: FilterChip; label: string }> = [
  { chip: "all", label: "All" },
  { chip: "in-progress", label: "In progress" },
  { chip: "synced", label: "Synced" },
  { chip: "empty", label: "Empty" },
];

const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: "recent", label: "Recently opened" },
  { key: "created", label: "Recently created" },
  { key: "title", label: "Title A to Z" },
  { key: "artist", label: "Artist A to Z" },
  { key: "duration", label: "Duration" },
];

// -- Components ---------------------------------------------------------------

const LibraryToolbar: React.FC<LibraryToolbarProps> = ({ filter, onFilterChange, sort, onSortChange }) => {
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? SORTS[0].label;

  return (
    <div className="flex items-end justify-between gap-4 mb-4 border-b border-composer-border select-none">
      <div role="tablist" aria-label="Filter projects" className="flex">
        {FILTERS.map(({ chip, label }) => {
          const active = filter === chip;
          return (
            <button
              key={chip}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilterChange(chip)}
              className={cn(
                "px-3 py-2 text-xs font-medium cursor-pointer transition-colors -mb-px border-b-2",
                active
                  ? "border-composer-accent text-composer-text"
                  : "border-transparent text-composer-text-muted hover:text-composer-text-secondary",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <Popover
        placement="bottom-end"
        trigger={
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 pl-3 pr-2.5 py-1.5 mb-1.5 rounded-md cursor-pointer",
              "text-xs font-medium bg-composer-button hover:bg-composer-button-hover",
              "transition-colors duration-150",
            )}
          >
            <IconSortDescending className="size-3.5" />
            {sortLabel}
            <IconChevronDown className="size-3.5 text-composer-text-muted" />
          </button>
        }
      >
        {(close) => (
          <ul className="py-1 min-w-44">
            {SORTS.map(({ key, label }) => (
              <li key={key}>
                <MenuItem
                  label={label}
                  selected={sort === key}
                  onClick={() => {
                    onSortChange(key);
                    close();
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Popover>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { LibraryToolbar };
