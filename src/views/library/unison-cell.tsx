import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { projectUnisonState, type UnisonLibraryLyrics } from "@/domain/unison/project-unison-state";
import { ScoreLabel } from "@/ui/unison/score-label";
import { DescribedUnisonStatusChip } from "@/ui/unison/unison-status-chip";
import { cn } from "@/utils/cn";

// -- Types ---------------------------------------------------------------------

interface UnisonCellProps {
  project: ProjectIndexEntry;
  lyrics: UnisonLibraryLyrics | null;
  className?: string;
}

// -- Constants -----------------------------------------------------------------

const CELL_TEXT = "truncate text-[13px]";

// -- Components ----------------------------------------------------------------

const UnisonCell: React.FC<UnisonCellProps> = ({ project, lyrics, className }) => {
  const state = projectUnisonState(project, lyrics);
  let content: React.ReactNode;
  if (state.kind === "linked") {
    content = (
      <>
        <DescribedUnisonStatusChip status={state.status} className="relative z-1" />
        {state.score !== null && <ScoreLabel score={state.score} voteCount={state.voteCount} className="truncate" />}
      </>
    );
  } else if (state.kind === "unknown") {
    content = <span className={cn(CELL_TEXT, "text-(--muted)")}>On Unison</span>;
  } else if (state.kind === "ready") {
    content = <span className={cn(CELL_TEXT, "text-(--muted)")}>Ready to submit</span>;
  } else {
    content = <span className={cn(CELL_TEXT, "text-composer-text-faint")}>Not submitted</span>;
  }
  return <div className={cn("flex items-center gap-3 min-w-0", className)}>{content}</div>;
};

const UnisonCardChip: React.FC<Omit<UnisonCellProps, "className">> = ({ project, lyrics }) => {
  const state = projectUnisonState(project, lyrics);
  return state.kind === "linked" ? <DescribedUnisonStatusChip status={state.status} className="relative z-1" /> : null;
};

// -- Exports -------------------------------------------------------------------

export { UnisonCardChip, UnisonCell };
