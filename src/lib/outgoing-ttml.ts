import { playedRanges } from "@/audio/playback-ranges";
import { withBuildTag } from "@/domain/alignment/build-tag";
import { withExportTiming } from "@/domain/alignment/export-timing";
import { alignmentBreakdown } from "@/domain/alignment/review-state";
import type { TimingGranularity } from "insync/project-timing-granularity";
import { useProjectStore } from "@/stores/project";
import { generateProjectTtml } from "insync/ttml/write";
import { getSplitCharacter } from "@/utils/split-character";

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
  const { metadata, agents, lines, groups, parts, passthrough, alignedTimings } = useProjectStore.getState();
  const { counts, untouchedIds } = alignmentBreakdown(lines, alignedTimings, playedRanges());
  if (editedContent !== null && editedContent !== generatedContent)
    return withBuildTag(editedContent, { ...counts, handEdited: true });
  const settled = exportTiming === "line" ? lines : withExportTiming(lines, untouchedIds);
  const ttml = generateProjectTtml(
    { metadata, agents, lines: settled, groups, parts, passthrough },
    duration,
    getSplitCharacter(),
    exportTiming,
    youtubeVideoId,
  );
  return withBuildTag(ttml, { ...counts, handEdited: false });
}

// -- Exports ------------------------------------------------------------------

export { outgoingTtml };
