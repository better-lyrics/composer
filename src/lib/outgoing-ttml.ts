import { playedRanges } from "@/audio/playback-ranges";
import { withBuildTag } from "@/domain/alignment/build-tag";
import { withExportTiming } from "@/domain/alignment/export-timing";
import { alignmentBreakdown } from "@/domain/alignment/review-state";
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
  const { counts, untouchedIds } = alignmentBreakdown(lines, alignedTimings, playedRanges());
  if (editedContent !== null && editedContent !== generatedContent)
    return withBuildTag(editedContent, { ...counts, handEdited: true });
  const settled = exportTiming === "line" ? lines : withExportTiming(lines, untouchedIds);
  const ttml = generateProjectTtml(
    { metadata, agents, lines: settled, groups },
    duration,
    exportTiming,
    youtubeVideoId,
  );
  return withBuildTag(ttml, { ...counts, handEdited: false });
}

// -- Exports ------------------------------------------------------------------

export { outgoingTtml };
