import { alignmentReview } from "@/domain/alignment/review-state";
import { FINISH_OPEN_PROMPT_FIRST, askChoice } from "@/stores/choice-store";
import { useProjectStore } from "@/stores/project";
import { UNREVIEWED_REASON, UNREVIEWED_TITLE } from "@/views/export/alignment-review-copy";
import { revealLineInTimeline } from "@/views/timeline/line-reveal-request";
import { useCallback, useMemo } from "react";

// -- Types --------------------------------------------------------------------

type ExportKind = "copy" | "download";
type AlignmentNotice = "unreviewed" | "mostly-unreviewed" | null;

// -- Constants ----------------------------------------------------------------

const ANYWAY_LABEL: Record<ExportKind, string> = { copy: "Copy anyway", download: "Download anyway" };

// -- Hook ---------------------------------------------------------------------

function useAlignmentReview() {
  const lines = useProjectStore((state) => state.lines);
  const alignedTimings = useProjectStore((state) => state.alignedTimings);
  const dismissed = useProjectStore((state) => state.alignmentNoticeDismissed);
  const review = useMemo(() => alignmentReview(lines, alignedTimings), [lines, alignedTimings]);

  const notice: AlignmentNotice =
    review.tier === "untouched"
      ? "unreviewed"
      : review.tier === "mostly-untouched" && !dismissed
        ? "mostly-unreviewed"
        : null;

  const reviewInTimeline = useCallback(() => {
    if (review.firstUntouchedLineId) revealLineInTimeline(review.firstUntouchedLineId, null);
    else useProjectStore.getState().setActiveTab("timeline");
  }, [review.firstUntouchedLineId]);

  const confirmExport = useCallback(
    async (kind: ExportKind): Promise<boolean> => {
      if (review.tier !== "untouched") return true;
      const answer = await askChoice({
        title: UNREVIEWED_TITLE,
        body: UNREVIEWED_REASON,
        busyMessage: FINISH_OPEN_PROMPT_FIRST,
        options: [
          { value: "export", label: ANYWAY_LABEL[kind], variant: "secondary" },
          { value: "review", label: "Review in Timeline", variant: "primary" },
        ],
      });
      if (answer === "review") reviewInTimeline();
      return answer === "export";
    },
    [review.tier, reviewInTimeline],
  );

  const dismiss = useCallback(() => useProjectStore.getState().dismissAlignmentNotice(), []);

  return { review, notice, reviewInTimeline, confirmExport, dismiss };
}

// -- Exports ------------------------------------------------------------------

export { useAlignmentReview };
export type { AlignmentNotice };
