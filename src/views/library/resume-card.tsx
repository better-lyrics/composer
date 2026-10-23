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

const MAX_LEDS = 64;

const CARD_STYLES = cn(
  "relative isolate flex flex-col justify-between gap-7 min-h-62 p-6 overflow-hidden rounded-xl bg-composer-bg-dark text-white select-none",
  "shadow-[inset_0_0_0_1px_var(--edge)]",
  "before:absolute before:inset-0 before:-z-1 before:pointer-events-none",
  "before:bg-[linear-gradient(100deg,rgb(0_0_0/0.55),rgb(0_0_0/0.2)_60%,rgb(0_0_0/0.45)),linear-gradient(to_top,rgb(0_0_0/0.55),transparent_55%)]",
);

// -- Sub-components -------------------------------------------------------------

const ResumeProgress: React.FC<{ project: ProjectIndexEntry }> = ({ project }) => {
  const description = progressDescription(project);
  if (!hasLyrics(project)) {
    return <div className="text-[13px] text-white/80">{description}</div>;
  }
  const percent = syncedPercent(project);
  const ledCount = Math.min(project.lineCount, MAX_LEDS);
  return (
    <div className="flex flex-col gap-2.5 min-w-0">
      <div className="flex justify-between gap-4 text-[13px] text-white/75">
        <span className="truncate">{description}</span>
        <span className="font-mono text-white tabular-nums">{percent}%</span>
      </div>
      <ProgressBar percent={percent} label={description} tone="on-media" segments={ledCount} />
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
        <ProjectArt src={project.thumbnailDataUrl} size="hero" className="bg-white/10 [&_svg]:text-white" />
        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-[13px] text-white/70">Edited {formatRelativeTimeInline(project.updatedAt, now)}</p>
          <h2
            id={titleId}
            className="text-[32px] font-bold leading-[1.1] tracking-[-0.015em] text-balance wrap-break-word line-clamp-2 select-text"
          >
            {displayTitle(project.title)}
          </h2>
          <p className="mt-1.5 text-[15px] text-white/75 truncate select-text">{displayArtists(project.artists)}</p>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
        <ResumeProgress project={project} />
        <Button variant="primary" size="lg" hasIcon onClick={() => onOpen(project.id)}>
          <IconPlayerPlayFilled aria-hidden="true" className="size-3.5" />
          {action}
        </Button>
      </div>
    </section>
  );
};

// -- Exports ------------------------------------------------------------------

export { ResumeCard };
