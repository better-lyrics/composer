import { alignmentReview } from "@/domain/alignment/review-state";
import { effectiveBounds } from "@/domain/line/bounds";
import { useAudioStore } from "@/stores/audio";
import { FINISH_OPEN_PROMPT_FIRST, askChoice } from "@/stores/choice-store";
import { useProjectStore } from "@/stores/project";
import { UNREVIEWED_REASON, UNREVIEWED_TITLE } from "@/views/export/alignment-review-copy";
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
    const project = useProjectStore.getState();
    const line = project.lines.find((candidate) => candidate.id === review.firstUntouchedLineId);
    const begin = line ? effectiveBounds(line)?.begin : undefined;
    project.setActiveTab("timeline");
    if (begin !== undefined) useAudioStore.getState().seekTo(begin, "centre");
  }, [review.firstUntouchedLineId]);

  const confirmExport = useCallback(
    async (kind: ExportKind): Promise<boolean> => {
      if (review.tier !== "untouched") return true;
      const answer = await askChoice({
        title: UNREVIEWED_TITLE,
        body: UNREVIEWED_REASON,
        busyMessage: FINISH_OPEN_PROMPT_FIRST,
        options: [
          { value: "export", label: ANYWAY_LABEL[kind], variant: "destructive" },
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
