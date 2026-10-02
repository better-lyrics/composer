import { displayArtists, displayTitle } from "@/domain/project/display-title";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { hasLyrics, progressDescription, syncedPercent } from "@/domain/project/progress";
import type { ProjectTab } from "@/domain/project/tab";
import { Button } from "@/ui/button";
import { KawarpBackdrop } from "@/ui/kawarp-backdrop";
import { ProgressBar } from "@/ui/progress-bar";
import { ProjectArt } from "@/ui/projects/project-art";
import { cn } from "@/utils/cn";
import { formatRelativeTimeInline } from "@/utils/format-relative-time";
import { IconPlayerPlayFilled } from "@tabler/icons-react";
import { useId } from "react";

// -- Types --------------------------------------------------------------------

interface ResumeCardProps {
  project: ProjectIndexEntry;
  now: number;
  onOpen: (id: string) => void;
  className?: string;
}

// -- Constants ----------------------------------------------------------------

const RESUME_ACTIONS: Record<ProjectTab, string> = {
  import: "Continue importing",
  edit: "Continue editing",
  languages: "Continue in Languages",
  sync: "Continue syncing",
  timeline: "Continue in Timeline",
  preview: "Open preview",
  export: "Open export",
};

const DEFAULT_RESUME_ACTION = "Open project";

const CARD_STYLES = cn(
  "relative isolate flex flex-col justify-between gap-6 min-h-62 p-6 overflow-hidden rounded-2xl bg-composer-bg-dark text-white select-none",
  "before:absolute before:inset-0 before:-z-1 before:pointer-events-none",
  "before:bg-[linear-gradient(to_top,rgb(0_0_0/0.6),rgb(0_0_0/0.28))]",
  "after:absolute after:inset-0 after:-z-1 after:rounded-[inherit] after:pointer-events-none",
  "after:shadow-[inset_0_0_0_1px_var(--color-composer-border),0_0_0_8px_var(--color-composer-bg)]",
);

// -- Sub-components -------------------------------------------------------------

const ResumeProgress: React.FC<{ project: ProjectIndexEntry }> = ({ project }) => {
  const description = progressDescription(project);
  if (!hasLyrics(project)) {
    return <div className="text-[13px] text-white/80">{description}</div>;
  }
  const percent = syncedPercent(project);
  return (
    <div>
      <div className="flex justify-between gap-4 mb-2 text-[13px] text-white/80">
        <span className="truncate">{description}</span>
        <strong className="font-medium text-white tabular-nums">{percent}%</strong>
      </div>
      <ProgressBar percent={percent} label={description} tone="on-media" />
    </div>
  );
};

// -- Component ----------------------------------------------------------------

const ResumeCard: React.FC<ResumeCardProps> = ({ project, now, onOpen, className }) => {
  const titleId = useId();
  const action = project.lastTab ? RESUME_ACTIONS[project.lastTab] : DEFAULT_RESUME_ACTION;

  return (
    <section aria-labelledby={titleId} className={cn(CARD_STYLES, className)}>
      <KawarpBackdrop
        src={project.thumbnailDataUrl}
        className="absolute inset-0 -z-2 overflow-hidden rounded-[inherit] [contain:strict]"
      />
      <div className="flex items-center gap-5">
        <ProjectArt src={project.thumbnailDataUrl} size="hero" />
        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-[13px] text-white/72">Edited {formatRelativeTimeInline(project.updatedAt, now)}</p>
          <h2 id={titleId} className="text-[32px] font-bold leading-[1.1] tracking-[-0.015em] text-balance select-text">
            {displayTitle(project.title)}
          </h2>
          <p className="mt-1.5 text-[15px] text-white/80 select-text">{displayArtists(project.artists)}</p>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
        <ResumeProgress project={project} />
        <Button hasIcon onClick={() => onOpen(project.id)} className="bg-white text-[#111] hover:bg-white/88">
          <IconPlayerPlayFilled aria-hidden="true" className="size-4" />
          {action}
        </Button>
      </div>
    </section>
  );
};

// -- Exports ------------------------------------------------------------------

export { ResumeCard };
