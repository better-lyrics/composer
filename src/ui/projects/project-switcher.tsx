import { displayArtists, displayTitle } from "@/domain/project/display-title";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { recentProjects } from "@/domain/project/recent-projects";
import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { useProjectIndex } from "@/hooks/useProjectIndex";
import { createProject, openProject } from "@/lib/open-project";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { Button } from "@/ui/button";
import { buttonClassName } from "@/ui/button-class-name";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { ProjectArt } from "@/ui/projects/project-art";
import { ProjectProgress } from "@/ui/projects/project-progress";
import { Scroll } from "@/ui/scroll";
import { LIBRARY_PATH } from "@/utils/app-routes";
import { cn } from "@/utils/cn";
import { formatRelativeTime } from "@/utils/format-relative-time";
import { IconArrowRight, IconPlus, IconSearch } from "@tabler/icons-react";
import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface ProjectSwitcherProps {
  onClose: () => void;
}

interface SwitcherRowProps {
  project: ProjectIndexEntry;
  optionId: string;
  isActive: boolean;
  now: number;
  onActivate: () => void;
  onChoose: () => void;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[ProjectSwitcher]";
const SWITCHER_LIMIT = 6;

// -- Sub-components -----------------------------------------------------------

const SwitcherRow: React.FC<SwitcherRowProps> = ({ project, optionId, isActive, now, onActivate, onChoose }) => (
  <button
    type="button"
    role="option"
    id={optionId}
    tabIndex={-1}
    aria-selected={isActive}
    onMouseMove={onActivate}
    onClick={onChoose}
    className={cn(
      "grid grid-cols-[36px_minmax(0,1fr)_56px_72px] items-center gap-3 w-full h-13 px-2 rounded-lg text-left cursor-pointer",
      isActive && "bg-composer-button",
    )}
  >
    <ProjectArt src={project.thumbnailDataUrl} size="md" />
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium text-composer-text">{displayTitle(project.title)}</span>
      <span
        className={cn(
          "block truncate text-[13px]",
          isActive ? "text-composer-text-secondary" : "text-composer-text-muted",
        )}
      >
        {displayArtists(project.artists)}
      </span>
    </span>
    <ProjectProgress lineCount={project.lineCount} syncedLineCount={project.syncedLineCount} isActive={isActive} />
    <span
      className={cn(
        "text-xs text-right whitespace-nowrap tabular-nums",
        isActive ? "text-composer-text-secondary" : "text-composer-text-muted",
      )}
    >
      {formatRelativeTime(project.updatedAt, now)}
    </span>
  </button>
);

// -- Component ----------------------------------------------------------------

const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({ onClose }) => {
  const listId = useId();
  const openId = useOpenProjectId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [now] = useState(Date.now);
  const { entries, error } = useProjectIndex();

  const projects = useMemo(
    () => recentProjects(entries ?? [], { excludeId: openId, query, limit: SWITCHER_LIMIT }),
    [entries, openId, query],
  );
  const safeActiveIndex = projects.length === 0 ? 0 : Math.min(activeIndex, projects.length - 1);
  const activeProject = projects[safeActiveIndex];
  const optionId = (index: number) => `${listId}-option-${index}`;

  const choose = (id: string) => {
    onClose();
    openProject(id).catch((error: unknown) => {
      console.error(LOG_PREFIX, "could not open the project", error);
      toast.error("Couldn't open that project");
    });
  };

  const startNewProject = () => {
    onClose();
    createProject();
  };

  const moveActive = (next: number) => {
    setActiveIndex(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      onClose();
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    if (event.key === "ArrowDown" && projects.length > 0) {
      event.preventDefault();
      moveActive(Math.min(safeActiveIndex + 1, projects.length - 1));
    } else if (event.key === "ArrowUp" && projects.length > 0) {
      event.preventDefault();
      moveActive(Math.max(safeActiveIndex - 1, 0));
    } else if (event.key === "Enter" && activeProject) {
      event.preventDefault();
      choose(activeProject.id);
    }
  };

  const emptyMessage = query.trim() ? `No projects match “${query.trim()}”` : "No other projects yet";

  return (
    <div className="w-[440px]">
      <div className="flex items-center gap-2.5 h-12 px-3 border-b border-composer-border">
        <IconSearch aria-hidden="true" className="size-[18px] shrink-0 text-composer-text opacity-50" />
        <input
          type="text"
          role="combobox"
          aria-expanded={projects.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeProject ? optionId(safeActiveIndex) : undefined}
          aria-label="Search projects"
          placeholder="Search projects"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 bg-transparent text-[15px] text-composer-text placeholder:text-composer-text-muted outline-none cursor-text select-text"
        />
        <InlineKeyBadge text="esc" />
      </div>
      <Scroll className="max-h-90">
        <div className="p-1">
          {error ? (
            <p className="px-3 py-7 text-sm text-center text-composer-text-muted select-text">Couldn't load projects</p>
          ) : (
            <>
              {projects.length > 0 && (
                <div aria-hidden="true" className="px-2 pt-2 pb-1 text-xs font-medium text-composer-text-muted">
                  {query.trim() ? "Results" : "Recent"}
                </div>
              )}
              <div id={listId} role="listbox" aria-label="Projects" className="flex flex-col gap-0.5">
                {projects.map((project, index) => (
                  <SwitcherRow
                    key={project.id}
                    project={project}
                    optionId={optionId(index)}
                    isActive={index === safeActiveIndex}
                    now={now}
                    onActivate={() => setActiveIndex(index)}
                    onChoose={() => choose(project.id)}
                  />
                ))}
              </div>
              {entries && projects.length === 0 && (
                <p className="px-3 py-7 text-sm text-center text-composer-text-muted select-text">{emptyMessage}</p>
              )}
            </>
          )}
        </div>
      </Scroll>
      <div className="flex items-center justify-between p-1 border-t border-composer-border">
        <Button
          variant="ghost"
          size="sm"
          hasIcon
          onClick={startNewProject}
          className="text-[13px] text-composer-text-secondary"
        >
          <IconPlus aria-hidden="true" className="size-[15px] text-composer-text opacity-50" />
          New project
          <InlineKeyBadge keys={getEffectiveKeysArray("global.newProject")} />
        </Button>
        <Link
          to={LIBRARY_PATH}
          onClick={onClose}
          className={cn(
            buttonClassName({ variant: "ghost", size: "sm" }),
            "gap-2 text-[13px] text-composer-text-secondary",
          )}
        >
          All projects
          <IconArrowRight aria-hidden="true" className="size-[15px] text-composer-text opacity-50" />
        </Link>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ProjectSwitcher };
