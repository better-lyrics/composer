import { IconSearch } from "@tabler/icons-react";
import { useMemo } from "react";
import type { LibraryProject } from "@/domain/project/library-project";
import { useLibraryProjects } from "@/hooks/useLibraryProjects";
import { NewProjectCard } from "@/pages/library/new-project-card";
import { EmptyState } from "@/ui/empty-state";
import { ProjectCard } from "@/ui/library/project-card";
import { cn } from "@/utils/cn";
import { MOD_KEY } from "@/utils/platform";

// -- Interfaces ---------------------------------------------------------------

interface LibraryPageProps {
  onOpenProject: (id: string) => void;
  onNewProject: () => void;
  onOpenSearch?: () => void;
}

// -- Helpers ------------------------------------------------------------------

function partitionPinned(projects: LibraryProject[]): {
  pinned: LibraryProject[];
  rest: LibraryProject[];
} {
  const pinned: LibraryProject[] = [];
  const rest: LibraryProject[] = [];
  for (const project of projects) {
    if (project.pinned) pinned.push(project);
    else rest.push(project);
  }
  return { pinned, rest };
}

// -- Sub-components -----------------------------------------------------------

interface SearchBoxProps {
  onClick?: () => void;
}

const SearchBox: React.FC<SearchBoxProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-3 py-2 w-70 cursor-pointer select-none",
      "bg-composer-input border border-composer-border rounded-lg",
      "hover:border-composer-border-hover transition-colors duration-150",
    )}
  >
    <IconSearch className="size-3.5 text-composer-text-muted" />
    <span className="flex-1 text-left text-[13px] text-composer-text-muted">Search projects, commands</span>
    <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-composer-button text-composer-text-secondary font-mono">
      {MOD_KEY}K
    </kbd>
  </button>
);

const SectionLabel: React.FC<{ children: React.ReactNode; first?: boolean }> = ({ children, first }) => (
  <h2
    className={cn(
      "text-[10px] font-semibold uppercase tracking-[0.1em] text-composer-text-faint mb-3 select-none",
      first ? "mt-0" : "mt-7",
    )}
  >
    {children}
  </h2>
);

const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">{children}</div>
);

// -- Page ---------------------------------------------------------------------

const LibraryPage: React.FC<LibraryPageProps> = ({ onOpenProject, onNewProject, onOpenSearch }) => {
  const { data: projects = [] } = useLibraryProjects();
  const { pinned, rest } = useMemo(() => partitionPinned(projects), [projects]);
  const isEmpty = projects.length === 0;

  if (isEmpty) {
    return (
      <main className="flex-1 overflow-auto p-12">
        <EmptyState
          message="Drop an audio file to start"
          hint="Everything stays in your browser. No account needed."
          action={
            <button
              type="button"
              onClick={onNewProject}
              className={cn(
                "mt-6 px-4 py-2 rounded-lg cursor-pointer text-sm font-medium",
                "bg-composer-accent/15 text-composer-accent-text hover:bg-composer-accent/25",
                "transition-colors duration-150",
              )}
            >
              New project
            </button>
          }
        />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto px-12 pt-9 pb-20">
      <header className="flex items-end justify-between gap-6 mb-7 select-none">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Your library</h1>
          <p className="text-[13px] text-composer-text-muted mt-1">
            {projects.length} {projects.length === 1 ? "project" : "projects"}, stored locally in your browser
          </p>
        </div>
        <SearchBox onClick={onOpenSearch} />
      </header>

      {pinned.length > 0 && (
        <section aria-labelledby="library-pinned-heading">
          <SectionLabel first>
            <span id="library-pinned-heading">Pinned</span>
          </SectionLabel>
          <Grid>
            {pinned.map((project) => (
              <ProjectCard key={project.id} project={project} onOpen={onOpenProject} />
            ))}
          </Grid>
        </section>
      )}

      <section aria-labelledby="library-recent-heading">
        <SectionLabel first={pinned.length === 0}>
          <span id="library-recent-heading">Recent</span>
        </SectionLabel>
        <Grid>
          <NewProjectCard onClick={onNewProject} />
          {rest.map((project) => (
            <ProjectCard key={project.id} project={project} onOpen={onOpenProject} />
          ))}
        </Grid>
      </section>
    </main>
  );
};

// -- Exports ------------------------------------------------------------------

export { LibraryPage };
