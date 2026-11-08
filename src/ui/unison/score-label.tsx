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

const ScoreLabel: React.FC<ScoreLabelProps> = ({ score, voteCount, className }) =>
  voteCount === 0 ? (
    <span className={cn("text-[13px] text-composer-text-faint whitespace-nowrap", className)}>No votes yet</span>
  ) : (
    <span className={cn("text-[13px] tabular-nums text-(--label) whitespace-nowrap", className)}>
      <span className="text-(--muted)">Score </span>
      <span className="font-medium">{formatScore(score)}</span>
      <span aria-hidden="true"> ・ </span>
      <span className="sr-only">, </span>
      {pluralize(voteCount, "vote")}
    </span>
  );

// -- Exports -------------------------------------------------------------------

export { ScoreLabel };
