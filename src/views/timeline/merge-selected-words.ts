import { withAlignedWords } from "@/domain/language/align";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import { type WordTrack, trackField } from "@/domain/line/tracks";
import { mergeWordRun } from "@/domain/word/merge-run";
import { useProjectStore } from "@/stores/project";
import { handleWordChangeWithDivergenceCheck } from "@/utils/word-divergence-flow";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Functions -----------------------------------------------------------------

async function mergeSelectedWords(lineId: string, type: WordTrack, indices: number[]): Promise<void> {
  const line = useProjectStore.getState().lines.find((l) => l.id === lineId);
  if (!line) return;
  const field = trackField(type);
  const words = withAlignedWords(line)[field];
  if (!words) return;
  const merged = mergeWordRun(words, indices);
  if (!merged) return;
  useTimelineStore.getState().clearSelection();
  await handleWordChangeWithDivergenceCheck(
    lineId,
    merged,
    field,
    field === "backgroundWords" ? manualBackgroundWordEdit(merged) : {},
  );
}

// -- Exports -------------------------------------------------------------------

export { mergeSelectedWords };
