import { ProjectCard } from "@/views/library/project-card";
import type { ProjectCollectionProps } from "@/views/library/project-list";

// -- Component ----------------------------------------------------------------

const ProjectGrid: React.FC<ProjectCollectionProps> = ({
  projects,
  now,
  selectedIds,
  menuProjectId,
  onOpen,
  onToggleSelect,
  onOpenMenu,
}) => (
  <ul
    aria-label="Projects"
    data-selecting={selectedIds.size > 0}
    className="group/grid grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-5 gap-y-8 pt-4"
  >
    {projects.map((project) => (
      <ProjectCard
        key={project.id}
        project={project}
        now={now}
        isSelected={selectedIds.has(project.id)}
        isMenuOpen={menuProjectId === project.id}
        onOpen={onOpen}
        onToggleSelect={onToggleSelect}
        onOpenMenu={onOpenMenu}
      />
    ))}
  </ul>
);

// -- Exports ------------------------------------------------------------------

export { ProjectGrid };
