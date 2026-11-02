import { revisionDiffLines } from "@/domain/unison/revision-changes";
import { useRevisionDiff } from "@/hooks/unison/useRevisions";
import type { RevisionDiff } from "@/lib/unison/revision-types";
import { DiffList } from "@/ui/unison/diff-list";
import { InlineError, SkeletonBar, SkeletonRows } from "@/views/unison/view-states";
import { useMemo } from "react";

// -- Interfaces ----------------------------------------------------------------

interface RevisionDiffSectionProps {
  lyricId: number;
  revId: number;
  againstRevId: number | null;
  isLive: boolean;
}

// -- Constants -----------------------------------------------------------------

const DIFF_LABEL_STYLES = "text-xs font-medium text-(--muted)";
const DIFF_FRAME_STYLES = "flex-1 min-h-0 rounded-[10px] bg-(--well) shadow-[inset_0_0_0_1px_var(--edge)]";

// -- Copy ----------------------------------------------------------------------

function diffLabel(diff: RevisionDiff | undefined, isLive: boolean): string {
  if (!isLive) return "Compared with what listeners see now";
  if (!diff) return "Compared with the revision before";
  return diff.againstRevNo === null ? "First upload" : `Compared with revision ${diff.againstRevNo}`;
}

function emptyDiffMessage(diff: RevisionDiff, isLive: boolean): string {
  if (!isLive) return "Same lyrics as the live version.";
  if (diff.againstRevNo === null) return "Nothing to compare yet.";
  return `Same lyrics as revision ${diff.againstRevNo}.`;
}

// -- Components ----------------------------------------------------------------

const DiffSkeleton: React.FC = () => (
  <div className={`${DIFF_FRAME_STYLES} py-1.5`}>
    <SkeletonRows count={6} rowClassName="flex px-3 py-1.5">
      <SkeletonBar className="w-3/4" />
    </SkeletonRows>
  </div>
);

const RevisionDiffSection: React.FC<RevisionDiffSectionProps> = ({ lyricId, revId, againstRevId, isLive }) => {
  const query = useRevisionDiff(lyricId, revId, againstRevId);
  const lines = useMemo(() => (query.data ? revisionDiffLines(query.data.rows) : []), [query.data]);
  return (
    <div aria-busy={query.isPending} className="flex flex-col gap-2 flex-1 min-h-0">
      <span className={DIFF_LABEL_STYLES}>{diffLabel(query.data, isLive)}</span>
      {query.isPending && <DiffSkeleton />}
      {query.error && (
        <div className={DIFF_FRAME_STYLES}>
          <InlineError error={query.error} onRetry={() => void query.refetch()} />
        </div>
      )}
      {query.data &&
        (lines.length > 0 ? (
          <DiffList lines={lines} className="flex-1 min-h-0" />
        ) : (
          <p className={`${DIFF_FRAME_STYLES} px-3 py-4 text-sm text-composer-text-secondary`}>
            {emptyDiffMessage(query.data, isLive)}
          </p>
        ))}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { RevisionDiffSection };
