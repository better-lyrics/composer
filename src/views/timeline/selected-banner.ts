import { isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { isWordSelected } from "@/domain/selection/identity";
import type { WordSelection } from "@/domain/selection/model";
import { getWordsInInstance } from "@/views/timeline/utils";

// -- Types --------------------------------------------------------------------

interface InstanceRef {
  groupId: string;
  instanceIdx: number;
}

// -- Functions ----------------------------------------------------------------

function selectedBannerInstance(lines: readonly LyricLine[], selectedWords: WordSelection[]): InstanceRef | null {
  const first = selectedWords[0];
  if (!first) return null;
  const line = lines.find((candidate) => candidate.id === first.lineId);
  if (!line || !isLinked(line)) return null;
  const instanceWords = getWordsInInstance(lines, line.groupId, line.instanceIdx);
  if (instanceWords.length !== selectedWords.length) return null;
  const selectsWholeInstance = instanceWords.every((word) =>
    isWordSelected(selectedWords, word.lineId, word.wordIndex, word.type),
  );
  return selectsWholeInstance ? { groupId: line.groupId, instanceIdx: line.instanceIdx } : null;
}

// -- Exports ------------------------------------------------------------------

export { selectedBannerInstance };
export type { InstanceRef };
