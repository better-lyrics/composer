import type { LibraryView } from "@/domain/project/library-preferences";
import type { LibraryFilter } from "@/domain/project/library-view";
import { EmptyState } from "@/ui/empty-state";
import { LibraryEmpty } from "@/views/library/library-empty";
import { ProjectGrid } from "@/views/library/project-grid";
import { type ProjectCollectionProps, ProjectList } from "@/views/library/project-list";

// -- Types --------------------------------------------------------------------

type LibraryIndexState = "loading" | "failed" | "loaded";

interface LibraryBodyProps {
  state: LibraryIndexState;
  view: LibraryView;
  collection: ProjectCollectionProps;
  query: string;
  filter: LibraryFilter;
  onClearSearch: () => void;
  onShowAll: () => void;
}

// -- Component ----------------------------------------------------------------

const LibraryBody: React.FC<LibraryBodyProps> = ({
  state,
  view,
  collection,
  query,
  filter,
  onClearSearch,
  onShowAll,
}) => {
  if (state === "failed") {
    return (
      <div className="flex py-18">
        <EmptyState message="Couldn't load your projects" hint="Reload the page to try again." />
      </div>
    );
  }
  if (state === "loading") return null;
  if (collection.projects.length === 0) {
    return <LibraryEmpty query={query} filter={filter} onClearSearch={onClearSearch} onShowAll={onShowAll} />;
  }
  return view === "grid" ? <ProjectGrid {...collection} /> : <ProjectList {...collection} />;
};

// -- Exports ------------------------------------------------------------------

export { LibraryBody };
export type { LibraryIndexState };
