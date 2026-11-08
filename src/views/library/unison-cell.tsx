import { displayTitle } from "@/domain/project/display-title";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { projectUnisonState } from "@/domain/unison/project-unison-state";
import { Button } from "@/ui/button";
import { BetterLyricsMark } from "@/ui/unison/better-lyrics-mark";
import { ScoreLabel } from "@/ui/unison/score-label";
import { DescribedUnisonStatusChip } from "@/ui/unison/unison-status-chip";
import { cn } from "@/utils/cn";
import { linkToUnison } from "@/views/library/link-to-unison";
import type { LibraryUnison } from "@/views/library/project-row";

// -- Types ---------------------------------------------------------------------

interface UnisonCellProps {
  project: ProjectIndexEntry;
  unison: LibraryUnison;
  className?: string;
}

// -- Constants -----------------------------------------------------------------

const CELL_TEXT = "truncate text-[13px]";
const ON_ART =
  "h-7 pl-2 pr-2.5 rounded-[6px] border border-transparent bg-composer-bg/80 text-composer-text backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.06),0_2px_4px_-1px_rgb(0_0_0/0.18),0_8px_20px_-6px_rgb(0_0_0/0.3)] hover:bg-composer-bg/90 hover:text-composer-text";

// -- Components ----------------------------------------------------------------

const LinkToUnisonButton: React.FC<UnisonCellProps & { onArt?: boolean }> = ({ project, unison, onArt, className }) => {
  const match = project.unisonLyricId ? undefined : unison.matches.get(project.id);
  if (!match) return null;
  return (
    <Button
      size="sm"
      variant={onArt ? "ghost" : "secondary"}
      hasIcon
      aria-label={`Link ${displayTitle(project.title)} to ${match.song} on Unison`}
      title={`${match.song} ・ ${match.artist}`}
      onClick={() => void linkToUnison([match])}
      className={cn("relative z-1 shrink-0", className)}
    >
      <BetterLyricsMark className="size-3.5" />
      Link to Unison
    </Button>
  );
};

const UnisonCell: React.FC<UnisonCellProps> = ({ project, unison, className }) => {
  const state = projectUnisonState(project, unison.lyrics);
  let content: React.ReactNode;
  if (!project.unisonLyricId && unison.matches.has(project.id)) {
    content = <LinkToUnisonButton project={project} unison={unison} />;
  } else if (state.kind === "linked") {
    content = (
      <>
        <DescribedUnisonStatusChip status={state.status} className="relative z-1" />
        {state.score !== null && <ScoreLabel score={state.score} voteCount={state.voteCount} className="truncate" />}
      </>
    );
  } else if (state.kind === "other-account") {
    content = <span className={cn(CELL_TEXT, "text-(--muted)")}>Other account</span>;
  } else if (state.kind === "unknown") {
    content = <span className={cn(CELL_TEXT, "text-(--muted)")}>On Unison</span>;
  } else if (state.kind === "ready") {
    content = <span className={cn(CELL_TEXT, "text-(--muted)")}>Ready to submit</span>;
  } else {
    content = <span className={cn(CELL_TEXT, "text-composer-text-faint")}>Not submitted</span>;
  }
  return <div className={cn("flex items-center gap-3 min-w-0", className)}>{content}</div>;
};

const UnisonCardChip: React.FC<Omit<UnisonCellProps, "className">> = ({ project, unison }) => {
  const state = projectUnisonState(project, unison.lyrics);
  if (state.kind !== "linked") return null;
  const detail =
    state.score === null ? undefined : (
      <ScoreLabel score={state.score} voteCount={state.voteCount} className="text-xs" />
    );
  return <DescribedUnisonStatusChip status={state.status} detail={detail} className="relative z-1" />;
};

const UnisonArtLink: React.FC<UnisonCellProps> = ({ className, ...props }) => (
  <LinkToUnisonButton {...props} onArt className={cn(ON_ART, className)} />
);

// -- Exports -------------------------------------------------------------------

export { UnisonArtLink, UnisonCardChip, UnisonCell };
