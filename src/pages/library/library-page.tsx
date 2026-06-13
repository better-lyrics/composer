import { IconMusic, IconSearch } from "@tabler/icons-react";
import { type MouseEvent, useCallback, useMemo, useState } from "react";
import { FileDropZone } from "@/audio/file-drop-zone";
import { YouTubeUrlInput } from "@/audio/youtube-url-input";
import type { LibraryProject } from "@/domain/project/library-project";
import { useLibraryActions } from "@/hooks/useLibraryActions";
import { useLibraryProjects } from "@/hooks/useLibraryProjects";
import { audioBlobs } from "@/lib/audio-blob-store-singleton";
import { createProjectFromAudio } from "@/lib/create-project";
import { openLibraryProject } from "@/lib/library-resume";
import { useAudioStore } from "@/stores/audio";
import { useUIStore } from "@/stores/ui";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { LibraryToolbar } from "@/ui/library/library-toolbar";
import { NewProjectCard } from "@/ui/library/new-project-card";
import { ProjectCard } from "@/ui/library/project-card";
import { ProjectCardContextMenu, type ProjectCardAction } from "@/ui/library/project-card-context-menu";
import { cn } from "@/utils/cn";
import { filterProjects, type FilterChip, type SortKey, sortProjects } from "@/utils/library/filter-sort";

// -- Interfaces ---------------------------------------------------------------

interface LibraryPageProps {
  onOpenProject: (id: string) => void;
  onOpenSearch?: () => void;
}

interface MenuState {
  project: LibraryProject;
  x: number;
  y: number;
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
    <InlineKeyBadge keys={["Mod", "P"]} trailing={false} />
  </button>
);

const SectionLabel: React.FC<{ children: React.ReactNode; first?: boolean }> = ({ children, first }) => (
  <h2 className={cn("text-xs font-semibold text-composer-text-muted mb-3 select-none", first ? "mt-0" : "mt-7")}>
    {children}
  </h2>
);

const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">{children}</div>
);

async function importFileAsLibraryProject(file: File): Promise<void> {
  if (useAudioStore.getState().isLoading) return;
  const id = await createProjectFromAudio({ kind: "file", file }, { audioBlobs });
  await openLibraryProject(id, { audioBlobs });
  useUIStore.getState().setViewingLibrary(false);
}

const OrDivider: React.FC = () => (
  <div className="flex items-center gap-3 w-full max-w-md select-none">
    <div className="flex-1 h-px bg-composer-border" />
    <span className="text-xs text-composer-text-muted">or</span>
    <div className="flex-1 h-px bg-composer-border" />
  </div>
);

interface EmptyLibraryViewProps {
  onFileDrop: (file: File) => void;
}

const EmptyLibraryView: React.FC<EmptyLibraryViewProps> = ({ onFileDrop }) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-6 p-6 text-center">
    <div className="select-none">
      <h1 className="text-[26px] font-bold tracking-tight">Welcome to Composer</h1>
      <p className="mt-1 text-sm text-composer-text-muted">
        Drop an audio file or paste a YouTube URL to start your first project
      </p>
    </div>
    <div className="w-full max-w-md min-h-48">
      <FileDropZone accept="audio/*" onFileDrop={onFileDrop}>
        <IconMusic className="size-12 mb-4 opacity-50 text-composer-text" stroke={1.5} />
        <p className="text-composer-text-secondary">Drop audio file here</p>
        <p className="mt-1 text-sm text-composer-text-muted">or click to browse</p>
        <p className="mt-4 text-xs text-composer-text-muted">Supports MP3, WAV, M4A, OGG, FLAC</p>
      </FileDropZone>
    </div>
    <OrDivider />
    <YouTubeUrlInput />
  </div>
);

// -- Page ---------------------------------------------------------------------

const LibraryPage: React.FC<LibraryPageProps> = ({ onOpenProject, onOpenSearch }) => {
  const { data: projects = [], isPending } = useLibraryProjects();
  const [filter, setFilter] = useState<FilterChip>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | undefined>(undefined);
  const actions = useLibraryActions();

  const filteredSorted = useMemo(() => sortProjects(filterProjects(projects, filter), sort), [projects, filter, sort]);

  const { pinned, rest } = useMemo(() => partitionPinned(filteredSorted), [filteredSorted]);
  const isEmpty = !isPending && projects.length === 0;

  const openMenu = useCallback(
    (event: MouseEvent, id: string) => {
      const project = projects.find((p) => p.id === id);
      if (!project) return;
      setMenu({ project, x: event.clientX, y: event.clientY });
    },
    [projects],
  );

  const handleAction = useCallback(
    async (action: ProjectCardAction) => {
      if (!menu) return;
      const id = menu.project.id;
      if (action === "open") {
        onOpenProject(id);
        return;
      }
      if (action === "rename") {
        setRenamingId(id);
        return;
      }
      if (action === "duplicate") {
        await actions.duplicate(id);
        return;
      }
      if (action === "pin-toggle") {
        await actions.togglePin(id);
        return;
      }
      if (action === "evict-audio") {
        await actions.evictAudio(id);
        return;
      }
      if (action === "export-ttml") {
        await actions.exportTtml(id);
        return;
      }
      if (action === "export-project-json") {
        await actions.exportProjectJson(id);
        return;
      }
      if (action === "delete") {
        await actions.delete(id);
        return;
      }
    },
    [menu, onOpenProject, actions],
  );

  const handleRenameCommit = useCallback(
    async (id: string, title: string) => {
      setRenamingId(undefined);
      await actions.rename(id, title);
    },
    [actions],
  );

  const handleRenameCancel = useCallback(() => {
    setRenamingId(undefined);
  }, []);

  const handleFileDrop = useCallback((file: File) => {
    void importFileAsLibraryProject(file);
  }, []);

  if (isEmpty) {
    return (
      <main className="flex-1 overflow-auto p-12 flex">
        <EmptyLibraryView onFileDrop={handleFileDrop} />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto px-12 pt-9 pb-20">
      <header className="flex items-center justify-between gap-6 mb-7 select-none">
        <h1 className="text-[26px] font-bold tracking-tight">Your library</h1>
        <SearchBox onClick={onOpenSearch} />
      </header>

      <LibraryToolbar filter={filter} onFilterChange={setFilter} sort={sort} onSortChange={setSort} />

      {pinned.length > 0 && (
        <section aria-labelledby="library-pinned-heading">
          <SectionLabel first>
            <span id="library-pinned-heading">Pinned</span>
          </SectionLabel>
          <Grid>
            {pinned.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={onOpenProject}
                onContextMenu={openMenu}
                isRenaming={renamingId === project.id}
                onRenameCommit={handleRenameCommit}
                onRenameCancel={handleRenameCancel}
              />
            ))}
          </Grid>
        </section>
      )}

      <section aria-labelledby="library-recent-heading">
        <SectionLabel first={pinned.length === 0}>
          <span id="library-recent-heading">Recent</span>
        </SectionLabel>
        <Grid>
          <NewProjectCard onFile={handleFileDrop} />
          {rest.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={onOpenProject}
              onContextMenu={openMenu}
              isRenaming={renamingId === project.id}
              onRenameCommit={handleRenameCommit}
              onRenameCancel={handleRenameCancel}
            />
          ))}
        </Grid>
      </section>

      {menu && (
        <ProjectCardContextMenu
          open
          position={{ x: menu.x, y: menu.y }}
          project={menu.project}
          onClose={() => setMenu(null)}
          onAction={handleAction}
        />
      )}
    </main>
  );
};

// -- Exports ------------------------------------------------------------------

export { LibraryPage };
