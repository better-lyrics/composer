import { displayArtists, displayTitle, hasArtists } from "@/domain/project/display-title";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { hasLyrics, progressDescription, projectStage, syncedPercent } from "@/domain/project/progress";
import { IconButton } from "@/ui/icon-button";
import type { MenuAnchor } from "@/ui/menu";
import { menuTriggerProps } from "@/ui/menu-trigger-props";
import { ProgressBar } from "@/ui/progress-bar";
import { ProjectArt } from "@/ui/projects/project-art";
import { SyncedBadge } from "@/ui/projects/synced-badge";
import { SelectCheckbox } from "@/ui/select-checkbox";
import { cn } from "@/utils/cn";
import { formatRelativeTime } from "@/utils/format-relative-time";
import { AudioStatusLabel } from "@/views/library/audio-status-label";
import { IconDots } from "@tabler/icons-react";
import { memo } from "react";

// -- Types --------------------------------------------------------------------

interface ProjectItemProps {
  project: ProjectIndexEntry;
  now: number;
  isSelected: boolean;
  isMenuOpen: boolean;
  onOpen: (id: string) => void;
  onToggleSelect: (id: string, range: boolean) => void;
  onOpenMenu: (id: string, anchor: MenuAnchor) => void;
}

// -- Constants ----------------------------------------------------------------

const ROW_GRID = cn(
  "grid items-center gap-x-4",
  "grid-cols-[40px_minmax(0,2fr)_minmax(0,1.2fr)_188px_136px_96px]",
  "max-[1100px]:grid-cols-[40px_minmax(0,2fr)_172px_128px_96px]",
);
const ALBUM_COLUMN = "max-[1100px]:hidden";
const ROW_MUTED = cn(
  "text-composer-text-muted",
  "group-hover/row:text-composer-text/60 group-data-selected/row:text-composer-text/60 group-data-menu/row:text-composer-text/60",
);
const ROW_PLACEHOLDER = "text-composer-text-faint";
const ROW_STYLES = cn(
  ROW_GRID,
  "group/row relative h-14 pl-3 pr-13 rounded-[10px] select-none transition-colors duration-100",
  "[content-visibility:auto] [contain-intrinsic-size:auto_56px]",
  "hover:bg-composer-input data-menu:bg-composer-input data-selected:bg-composer-accent/14",
  "has-[[data-row-open]:focus-visible]:outline-2 has-[[data-row-open]:focus-visible]:-outline-offset-2 has-[[data-row-open]:focus-visible]:outline-composer-accent",
);
const REVEAL_ON_ROW = "opacity-0 group-hover/row:opacity-100 group-data-[selecting=true]/list:opacity-100";

// -- Sub-components -----------------------------------------------------------

const RowProgress: React.FC<{ project: ProjectIndexEntry }> = ({ project }) => {
  if (!hasLyrics(project)) {
    return <span className={cn("text-[13px]", ROW_MUTED)}>{progressDescription(project)}</span>;
  }
  const percent = syncedPercent(project);
  return (
    <div className="flex items-center gap-3 pointer-events-none">
      <ProgressBar percent={percent} label={progressDescription(project)} className="flex-1" />
      {projectStage(project) === "synced" ? (
        <span className="inline-flex justify-end w-9 shrink-0">
          <SyncedBadge />
        </span>
      ) : (
        <span className={cn("w-9 shrink-0 text-right text-[13px] tabular-nums", ROW_MUTED)}>{percent}%</span>
      )}
    </div>
  );
};

// -- Component ----------------------------------------------------------------

const ProjectRowContent: React.FC<ProjectItemProps> = ({
  project,
  now,
  isSelected,
  isMenuOpen,
  onOpen,
  onToggleSelect,
  onOpenMenu,
}) => {
  const title = displayTitle(project.title);
  return (
    <li
      data-project-id={project.id}
      data-selected={isSelected || undefined}
      data-menu={isMenuOpen || undefined}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenu(project.id, { kind: "point", x: event.clientX, y: event.clientY, within: event.currentTarget });
      }}
      className={ROW_STYLES}
    >
      <div className="relative size-10">
        <ProjectArt
          src={project.thumbnailDataUrl}
          size="row"
          className={cn(
            "[&_svg]:transition-opacity [&_svg]:duration-100",
            "group-hover/row:[&_svg]:opacity-0 group-data-selected/row:[&_svg]:opacity-0 group-data-[selecting=true]/list:[&_svg]:opacity-0",
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-md bg-black/45 pointer-events-none transition-opacity duration-100",
            REVEAL_ON_ROW,
            "group-data-selected/row:opacity-100",
          )}
        />
        <SelectCheckbox
          label={`Select ${title}`}
          checked={isSelected}
          onToggle={(range) => onToggleSelect(project.id, range)}
          className={cn("absolute inset-0 z-2 m-auto checked:opacity-100 focus-visible:opacity-100", REVEAL_ON_ROW)}
        />
      </div>
      <div className="min-w-0">
        <button
          type="button"
          data-row-open
          onClick={() => onOpen(project.id)}
          className="block max-w-full truncate text-left font-medium text-composer-text cursor-pointer outline-none after:absolute after:inset-0 after:rounded-[inherit]"
        >
          {title}
        </button>
        <div className={cn("truncate text-[13px]", hasArtists(project.artists) ? ROW_MUTED : ROW_PLACEHOLDER)}>
          {displayArtists(project.artists)}
        </div>
      </div>
      <div className={cn("truncate text-[13px]", project.album ? ROW_MUTED : ROW_PLACEHOLDER, ALBUM_COLUMN)}>
        {project.album || "No album"}
      </div>
      <RowProgress project={project} />
      <div className="min-w-0">
        <AudioStatusLabel project={project} />
      </div>
      <div className={cn("text-right whitespace-nowrap text-[13px] tabular-nums", ROW_MUTED)}>
        {formatRelativeTime(project.updatedAt, now)}
      </div>
      <IconButton
        variant="ghost"
        label={`More actions for ${title}`}
        icon={<IconDots aria-hidden="true" className="size-5" />}
        {...menuTriggerProps(isMenuOpen)}
        onClick={(event) => onOpenMenu(project.id, { kind: "element", element: event.currentTarget })}
        className="absolute top-3 right-2 z-1 opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 group-data-menu/row:opacity-100"
      />
    </li>
  );
};

const ProjectRow = memo(ProjectRowContent);

// -- Exports ------------------------------------------------------------------

export { ProjectRow, ROW_GRID, ALBUM_COLUMN };
export type { ProjectItemProps };
