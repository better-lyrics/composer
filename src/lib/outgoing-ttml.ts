import { heardRanges } from "@/audio/heard-playback";
import { withBuildTag } from "@/domain/alignment/build-tag";
import { alignmentBreakdown } from "@/domain/alignment/review-state";
import { watermarkLines } from "@/domain/alignment/watermark";
import type { TimingGranularity } from "@/domain/project/timing-granularity";
import { useProjectStore } from "@/stores/project";
import { generateProjectTtml } from "@/utils/ttml";

// -- Types --------------------------------------------------------------------

interface OutgoingSource {
  editedContent: string | null;
  generatedContent: string;
  duration: number;
  exportTiming: TimingGranularity;
  youtubeVideoId: string | undefined;
}

// -- Functions ----------------------------------------------------------------

function outgoingTtml({
  editedContent,
  generatedContent,
  duration,
  exportTiming,
  youtubeVideoId,
}: OutgoingSource): string {
  const { metadata, agents, lines, groups, alignedTimings } = useProjectStore.getState();
  const { counts, untouchedIds } = alignmentBreakdown(lines, alignedTimings, heardRanges());
  if (editedContent !== null && editedContent !== generatedContent)
    return withBuildTag(editedContent, { ...counts, handEdited: true });
  const stamped = exportTiming === "line" ? lines : watermarkLines(lines, untouchedIds);
  const ttml = generateProjectTtml(
    { metadata, agents, lines: stamped, groups },
    duration,
    exportTiming,
    youtubeVideoId,
  );
  return withBuildTag(ttml, { ...counts, handEdited: false });
}

// -- Exports ------------------------------------------------------------------

export { outgoingTtml };
