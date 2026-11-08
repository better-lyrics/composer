import { displayTitle } from "@/domain/project/display-title";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { projectUnisonState } from "@/domain/unison/project-unison-state";
import { ART_PILL_STYLES } from "@/ui/art-pill-styles";
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
  <LinkToUnisonButton {...props} onArt className={cn(ART_PILL_STYLES, className)} />
);

// -- Exports -------------------------------------------------------------------

export { UnisonArtLink, UnisonCardChip, UnisonCell };
