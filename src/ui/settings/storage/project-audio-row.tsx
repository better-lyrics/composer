import { displayTitle } from "@/domain/project/display-title";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { lastOpenedAt } from "@/domain/project/opened-at";
import { IconButton } from "@/ui/icon-button";
import { ProjectArt } from "@/ui/projects/project-art";
import { cn } from "@/utils/cn";
import { formatFileSize } from "@/utils/format-file-size";
import { formatRelativeTimeInline } from "@/utils/format-relative-time";
import { IconBrandYoutube, IconFileMusic, IconTrash } from "@tabler/icons-react";
import { memo } from "react";

// -- Types --------------------------------------------------------------------

interface ProjectAudioRowProps {
  entry: ProjectIndexEntry;
  isOpen: boolean;
  now: number;
  onRemove: (entry: ProjectIndexEntry) => void;
}

// -- Component ----------------------------------------------------------------

const ProjectAudioRowView: React.FC<ProjectAudioRowProps> = ({ entry, isOpen, now, onRemove }) => {
  const title = displayTitle(entry.title);
  const isYouTube = entry.audioKind === "youtube";
  const KindIcon = isYouTube ? IconBrandYoutube : IconFileMusic;

  return (
    <li className="group grid h-11 grid-cols-[28px_minmax(0,1fr)_120px_72px_28px] items-center gap-3 rounded-lg px-2 hover:bg-composer-input">
      <ProjectArt src={entry.thumbnailDataUrl} size="xs" />
      <span className="min-w-0">
        <span data-audio-title className="block truncate text-[13px] font-medium text-composer-text select-text">
          {title}
        </span>
        <span className="block truncate text-xs text-composer-text-muted group-hover:text-composer-text/60 select-none">
          Opened {formatRelativeTimeInline(lastOpenedAt(entry), now)}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs text-composer-text-secondary select-none">
        <KindIcon aria-hidden="true" className="size-3.5 shrink-0 text-composer-text opacity-50" />
        {isYouTube ? "YouTube" : "Local file"}
      </span>
      <span className="text-right text-[13px] tabular-nums text-composer-text-secondary select-text">
        {formatFileSize(entry.storedAudioBytes)}
      </span>
      <IconButton
        label={isOpen ? `Close ${title} to remove its audio` : `Remove audio from ${title}`}
        icon={<IconTrash aria-hidden="true" className="size-4" />}
        variant="ghost"
        aria-disabled={isOpen ? "true" : undefined}
        onClick={isOpen ? undefined : () => onRemove(entry)}
        className={cn(
          "size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          isOpen && "cursor-not-allowed group-hover:opacity-35 hover:bg-transparent hover:text-composer-text-muted",
        )}
        {...(isOpen ? { title: "Close this project to remove its audio" } : {})}
      />
    </li>
  );
};

const ProjectAudioRow = memo(ProjectAudioRowView);

// -- Exports ------------------------------------------------------------------

export { ProjectAudioRow };
