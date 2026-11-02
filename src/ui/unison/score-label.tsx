import { formatScore } from "@/domain/unison/lyric-status";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";

// -- Types ---------------------------------------------------------------------

interface ScoreLabelProps {
  score: number;
  voteCount: number;
  className?: string;
}

// -- Component -----------------------------------------------------------------

const ScoreLabel: React.FC<ScoreLabelProps> = ({ score, voteCount, className }) => (
  <span className={cn("text-[13px] tabular-nums text-(--label) whitespace-nowrap", className)}>
    {formatScore(score)}
    <span className="sr-only"> score,</span>
    <span aria-hidden="true"> ・ </span>
    {pluralize(voteCount, "vote")}
  </span>
);

// -- Exports -------------------------------------------------------------------

export { ScoreLabel };
