import type { LibraryFilter } from "@/domain/project/library-view";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { IconSearchOff } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface LibraryEmptyProps {
  query: string;
  filter: LibraryFilter;
  onClearSearch: () => void;
  onShowAll: () => void;
}

// -- Constants ----------------------------------------------------------------

const EMPTY_FILTER_MESSAGES: Record<Exclude<LibraryFilter, "all">, string> = {
  "not-synced": "Every project has some timing",
  syncing: "No projects in progress",
  synced: "No synced projects yet",
};

// -- Component ----------------------------------------------------------------

const LibraryEmpty: React.FC<LibraryEmptyProps> = ({ query, filter, onClearSearch, onShowAll }) => {
  const trimmed = query.trim();
  let content: React.ReactNode;
  if (trimmed) {
    content = (
      <EmptyState
        icon={IconSearchOff}
        message={`No projects match “${trimmed}”`}
        hint="Search looks at titles, artists, and albums."
        action={
          <Button size="sm" onClick={onClearSearch} className="mt-3">
            Clear search
          </Button>
        }
      />
    );
  } else if (filter !== "all") {
    content = (
      <EmptyState
        message={EMPTY_FILTER_MESSAGES[filter]}
        hint="Try another filter."
        action={
          <Button size="sm" onClick={onShowAll} className="mt-3">
            Show all
          </Button>
        }
      />
    );
  } else {
    content = <EmptyState message="No projects" hint="Start a new song above." />;
  }
  return <div className="flex py-18 select-none">{content}</div>;
};

// -- Exports ------------------------------------------------------------------

export { LibraryEmpty };
