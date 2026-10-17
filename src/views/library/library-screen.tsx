import { storedAudioBytesTotal } from "@/domain/project/audio-status";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { type LibraryFilter, filterCounts, libraryProjects, resumeProject } from "@/domain/project/library-view";
import { useProjectIndex } from "@/hooks/useProjectIndex";
import { createProject } from "@/lib/open-project";
import { useSettingsStore } from "@/stores/settings";
import type { MenuAnchor } from "@/ui/menu";
import { EDITOR_PATH, screenForPath } from "@/utils/app-routes";
import { cn } from "@/utils/cn";
import { BulkBar } from "@/views/library/bulk-bar";
import { LibraryBody, type LibraryIndexState } from "@/views/library/library-body";
import { LibraryFooter } from "@/views/library/library-footer";
import { LibraryToolbar } from "@/views/library/library-toolbar";
import { NewSongPanel } from "@/views/library/new-song-panel";
import { type ProjectCollectionProps, ProjectListColumns } from "@/views/library/project-list";
import { ProjectMenu } from "@/views/library/project-menu";
import { RenameProjectModal } from "@/views/library/rename-project-modal";
import { ResumeCard } from "@/views/library/resume-card";
import { useLibraryActions } from "@/views/library/use-library-actions";
import { useLibrarySelection } from "@/views/library/use-library-selection";
import { useLibraryShortcuts } from "@/views/library/use-library-shortcuts";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

// -- Types --------------------------------------------------------------------

interface OpenMenu {
  project: ProjectIndexEntry;
  anchor: MenuAnchor;
}

// -- Constants ----------------------------------------------------------------

const NO_PROJECTS: readonly ProjectIndexEntry[] = [];
const PAGE_LOAD_LOCATION_KEY = "default";
const FIRST_PAINT_MS = 700;
const RISE = "group-data-[first-paint=true]/lib:animate-[library-rise_420ms_var(--ease-emphasized)_both]";

// -- Helpers ------------------------------------------------------------------

function menuKey(menu: OpenMenu): string {
  return menu.anchor.kind === "point"
    ? `${menu.project.id}:${menu.anchor.x}:${menu.anchor.y}`
    : `${menu.project.id}:button`;
}

function focusNextRow(root: HTMLElement | null, visible: readonly ProjectIndexEntry[], removed: Set<string>): boolean {
  const lastRemoved = visible.findLastIndex((project) => removed.has(project.id));
  const next = visible.slice(lastRemoved + 1).find((project) => !removed.has(project.id));
  const target = next && root?.querySelector<HTMLElement>(`[data-project-id="${CSS.escape(next.id)}"] [data-row-open]`);
  target?.focus();
  return Boolean(target);
}

function focusedProjectId(): string | undefined {
  const active = document.activeElement;
  return active instanceof HTMLElement
    ? active.closest<HTMLElement>("[data-project-id]")?.dataset.projectId
    : undefined;
}

// -- Component ----------------------------------------------------------------

const LibraryScreen: React.FC = () => {
  const { entries, stored, error, fetchedAt, fresh } = useProjectIndex();
  const location = useLocation();
  const [landing, setLanding] = useState(
    () => location.key === PAGE_LOAD_LOCATION_KEY && screenForPath(location.pathname) === "library",
  );
  const view = useSettingsStore((state) => state.libraryView);
  const setSetting = useSettingsStore((state) => state.set);
  const [sort, setSort] = useState(() => useSettingsStore.getState().librarySort);
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [renaming, setRenaming] = useState<ProjectIndexEntry | null>(null);
  const [firstPaint, setFirstPaint] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const actions = useLibraryActions();

  const live = entries ?? NO_PROJECTS;
  const visible = useMemo(() => libraryProjects(live, { filter, query, sort }), [live, filter, query, sort]);
  const visibleIds = useMemo(() => visible.map((project) => project.id), [visible]);
  const counts = useMemo(() => filterCounts(live), [live]);
  const resume = useMemo(() => resumeProject(live), [live]);
  const storedBytes = useMemo(() => storedAudioBytesTotal(live), [live]);
  const byId = useMemo(() => new Map(live.map((project) => [project.id, project])), [live]);
  const byIdRef = useRef(byId);
  const { selectedIds, toggle, selectAll, clear } = useLibrarySelection(visibleIds);
  const selecting = selectedIds.size > 0;
  const selectedProjects = useMemo(
    () => visible.filter((project) => selectedIds.has(project.id)),
    [visible, selectedIds],
  );

  useLayoutEffect(() => {
    byIdRef.current = byId;
  });

  useEffect(() => {
    if (landing && fresh) setLanding(false);
  }, [landing, fresh]);

  useEffect(() => {
    const timer = setTimeout(() => setFirstPaint(false), FIRST_PAINT_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleOpen = useCallback(
    (id: string) => {
      if (selecting) toggle(id, false);
      else actions.open(id);
    },
    [selecting, toggle, actions],
  );

  const openMenu = useCallback((id: string, anchor: MenuAnchor) => {
    setMenu((current) => {
      if (anchor.kind === "element" && current?.project.id === id && current.anchor.kind === "element") return null;
      const project = byIdRef.current.get(id);
      return project ? { project, anchor } : null;
    });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  const deleteProjects = (projects: readonly ProjectIndexEntry[]) => {
    const removed = new Set(projects.map((project) => project.id));
    if (!focusNextRow(mainRef.current, visible, removed)) searchRef.current?.focus();
    actions.remove(projects);
    clear();
  };

  useLibraryShortcuts({
    focusSearch: () => searchRef.current?.focus(),
    newProject: () => {
      createProject();
      navigate(EDITOR_PATH);
    },
    clearSelection: () => {
      if (!selecting || menu || renaming) return false;
      clear();
      return true;
    },
    deleteSelection: () => {
      if (menu || renaming) return false;
      if (selecting) {
        deleteProjects(selectedProjects);
        return true;
      }
      const id = focusedProjectId();
      const project = id ? byId.get(id) : undefined;
      if (!project) return false;
      deleteProjects([project]);
      return true;
    },
  });

  if (landing && fresh && stored?.length === 0) return <Navigate to={EDITOR_PATH} replace />;

  const collection: ProjectCollectionProps = {
    projects: visible,
    now: fetchedAt,
    selectedIds,
    menuProjectId: menu?.project.id ?? null,
    onOpen: handleOpen,
    onToggleSelect: toggle,
    onOpenMenu: openMenu,
  };

  const indexState: LibraryIndexState = entries ? "loaded" : error ? "failed" : "loading";

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-composer-bg">
      <main ref={mainRef} className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div
          data-first-paint={firstPaint}
          className="group/lib max-w-[1264px] mx-auto px-16 pt-8 pb-30 max-[720px]:px-5"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-4 mb-10 max-[1180px]:grid-cols-[minmax(0,1fr)_320px] max-[880px]:grid-cols-1">
            {resume && <ResumeCard project={resume} now={fetchedAt} onOpen={actions.open} className={RISE} />}
            <NewSongPanel className={cn(RISE, "[animation-delay:60ms]")} />
          </div>
          <section aria-label="All projects" className={cn(RISE, "[animation-delay:120ms]")}>
            <div className="sticky top-0 z-20 -ml-3 -mr-13 pl-3 pr-13 bg-composer-bg select-none">
              <LibraryToolbar
                count={live.length}
                filter={filter}
                counts={counts}
                onFilterChange={setFilter}
                query={query}
                onQueryChange={setQuery}
                searchRef={searchRef}
                sort={sort}
                onSortChange={setSort}
                view={view}
                onViewChange={(next) => setSetting("libraryView", next)}
              />
              {view === "list" && <ProjectListColumns />}
            </div>
            <LibraryBody
              state={indexState}
              view={view}
              collection={collection}
              query={query}
              filter={filter}
              onClearSearch={() => setQuery("")}
              onShowAll={() => setFilter("all")}
            />
            <LibraryFooter storedAudioBytes={storedBytes} onManageStorage={actions.manageStorage} />
          </section>
        </div>
      </main>
      {selecting && (
        <BulkBar
          selectedCount={selectedIds.size}
          visibleCount={visible.length}
          onSelectAll={selectAll}
          onExport={() => actions.exportFiles(selectedProjects.map((project) => project.id))}
          onDelete={() => deleteProjects(selectedProjects)}
          onClear={clear}
        />
      )}
      {menu && (
        <ProjectMenu
          key={menuKey(menu)}
          project={menu.project}
          anchor={menu.anchor}
          onClose={closeMenu}
          onOpen={actions.open}
          onRename={setRenaming}
          onDuplicate={actions.duplicate}
          onExport={(id) => actions.exportFiles([id])}
          onDelete={(project) => deleteProjects([project])}
        />
      )}
      {renaming && (
        <RenameProjectModal
          title={renaming.title}
          onRename={(title) => {
            actions.rename(renaming.id, title);
            setRenaming(null);
          }}
          onClose={() => setRenaming(null)}
        />
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { LibraryScreen };
