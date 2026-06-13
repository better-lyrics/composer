import { IconDots } from "@tabler/icons-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useState } from "react";
import type { LibraryProject } from "@/domain/project/library-project";
import { WaveformFallback } from "@/ui/library/waveform-fallback";
import { cn } from "@/utils/cn";
import { formatTime } from "@/utils/format-time";
import { relativeTime } from "@/utils/library/relative-time";
import { syncStateOf, type SyncState } from "@/domain/project/sync-state";

// -- Interfaces ---------------------------------------------------------------

interface ProjectCardProps {
  project: LibraryProject;
  onOpen: (id: string) => void;
  onContextMenu?: (event: MouseEvent, id: string) => void;
  isRenaming?: boolean;
  onRenameCommit?: (id: string, title: string) => void;
  onRenameCancel?: (id: string) => void;
}

// -- Constants ----------------------------------------------------------------

const SYNC_LABEL: Record<SyncState, string> = {
  synced: "Synced",
  partial: "In progress",
  empty: "Lyrics only",
};

const SYNC_DOT_CLASS: Record<SyncState, string> = {
  synced: "bg-composer-success",
  partial: "bg-composer-warning",
  empty: "bg-composer-text-faint",
};

function focusAndSelectOnMount(node: HTMLInputElement | null) {
  if (!node) return;
  node.focus();
  node.select();
}

// -- Subcomponents ------------------------------------------------------------

interface TitleEditorProps {
  initial: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
}

const TitleEditor: React.FC<TitleEditorProps> = ({ initial, onCommit, onCancel }) => {
  const [value, setValue] = useState(initial);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      onCommit(value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <input
      ref={focusAndSelectOnMount}
      type="text"
      aria-label="Project title"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={handleKeyDown}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      className={cn(
        "w-full text-[13px] font-semibold leading-tight truncate cursor-text",
        "bg-composer-input border border-composer-accent rounded px-1 py-0.5 outline-none select-text",
      )}
    />
  );
};

// -- Component ----------------------------------------------------------------

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpen,
  onContextMenu,
  isRenaming = false,
  onRenameCommit,
  onRenameCancel,
}) => {
  const state = syncStateOf(project);
  const title = project.metadata.title || "Untitled";
  const artist = project.metadata.artist || "";
  const duration = project.metadata.duration > 0 ? formatTime(project.metadata.duration, 0) : "No audio";
  const opened = relativeTime(project.lastOpenedAt);
  const thumb = project.metadata.thumbnailDataUrl;

  const handleContext = (e: MouseEvent) => {
    if (!onContextMenu) return;
    e.preventDefault();
    onContextMenu(e, project.id);
  };

  const handleMoreClick = (e: MouseEvent) => {
    e.stopPropagation();
    onContextMenu?.(e, project.id);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isRenaming) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(project.id);
    }
  };

  const handleCardClick = () => {
    if (isRenaming) return;
    onOpen(project.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContext}
      className={cn(
        "group relative flex flex-col text-left cursor-pointer bg-composer-bg-dark",
        "border border-composer-border rounded-xl overflow-hidden select-none",
        "transition-[transform,border-color] duration-150",
        "hover:-translate-y-px hover:border-composer-border-hover",
        "focus-visible:outline-none focus-visible:border-composer-accent",
      )}
    >
      <div className="relative aspect-square overflow-hidden">
        {thumb ? (
          <img src={thumb} alt="" className="block size-full object-cover" draggable={false} />
        ) : (
          <WaveformFallback seed={project.id} />
        )}
        <span
          className={cn(
            "absolute top-2 left-2 inline-flex items-center gap-1.5",
            "px-2 py-0.5 rounded-md bg-composer-bg-dark/85 border border-composer-border",
            "text-[11px] font-medium text-composer-text-secondary",
          )}
        >
          <span className={cn("size-1.5 rounded-full", SYNC_DOT_CLASS[state])} aria-hidden="true" />
          {SYNC_LABEL[state]}
        </span>
        <button
          type="button"
          aria-label="More actions"
          onClick={handleMoreClick}
          className={cn(
            "absolute top-1.5 right-1.5 size-6.5 rounded-md inline-flex items-center justify-center",
            "bg-black/50 text-white/85 cursor-pointer opacity-0 transition-opacity",
            "group-hover:opacity-100 hover:bg-black/70 focus-visible:opacity-100 focus-visible:outline-none",
          )}
        >
          <IconDots className="size-4" />
        </button>
      </div>
      <div className="px-3 pt-2.5 pb-3 min-w-0">
        {isRenaming ? (
          <TitleEditor
            initial={project.metadata.title}
            onCommit={(next) => onRenameCommit?.(project.id, next)}
            onCancel={() => onRenameCancel?.(project.id)}
          />
        ) : (
          <div className="text-[13px] font-semibold leading-tight truncate">{title}</div>
        )}
        <div className="text-[11px] text-composer-text-muted truncate mt-0.5">{artist}</div>
        <div className="flex justify-between mt-2 text-[10px] text-composer-text-faint font-mono">
          <span>{duration}</span>
          <span>{opened}</span>
        </div>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ProjectCard };
export type { ProjectCardProps };
