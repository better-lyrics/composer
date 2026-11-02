import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import type { MenuAnchor } from "@/ui/menu";
import { cn } from "@/utils/cn";
import { type LibraryUnison, ProjectRow, ROW_LAYOUTS, UNISON_COLUMN } from "@/views/library/project-row";

// -- Types --------------------------------------------------------------------

interface ProjectCollectionProps {
  projects: readonly ProjectIndexEntry[];
  now: number;
  selectedIds: ReadonlySet<string>;
  menuProjectId: string | null;
  unison: LibraryUnison | null;
  onOpen: (id: string) => void;
  onToggleSelect: (id: string, range: boolean) => void;
  onOpenMenu: (id: string, anchor: MenuAnchor) => void;
}

// -- Components ---------------------------------------------------------------

const ProjectList: React.FC<ProjectCollectionProps> = ({
  projects,
  now,
  selectedIds,
  menuProjectId,
  unison,
  onOpen,
  onToggleSelect,
  onOpenMenu,
}) => (
  <ul aria-label="Projects" data-selecting={selectedIds.size > 0} className="group/list -ml-3 -mr-13 pt-1 list-none">
    {projects.map((project) => (
      <ProjectRow
        key={project.id}
        project={project}
        now={now}
        isSelected={selectedIds.has(project.id)}
        isMenuOpen={menuProjectId === project.id}
        unison={unison}
        onOpen={onOpen}
        onToggleSelect={onToggleSelect}
        onOpenMenu={onOpenMenu}
      />
    ))}
  </ul>
);

const ProjectListColumns: React.FC<{ showUnison: boolean }> = ({ showUnison }) => {
  const layout = showUnison ? ROW_LAYOUTS.unison : ROW_LAYOUTS.plain;
  return (
    <div
      aria-hidden="true"
      className={cn(layout.grid, "h-8 shadow-[inset_0_-1px_0_var(--divider)] text-xs font-medium text-(--muted)")}
    >
      <span className="col-span-2">Title</span>
      <span className={layout.album}>Album</span>
      <span>Progress</span>
      {showUnison && <span className={UNISON_COLUMN}>Unison</span>}
      <span>Audio</span>
      <span className="text-right">Edited</span>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ProjectList, ProjectListColumns };
export type { ProjectCollectionProps };
