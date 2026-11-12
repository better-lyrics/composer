import { useProjectStore } from "@/stores/project";
import type { ProjectStore } from "@/stores/project/types";
import { pluralize } from "@/utils/pluralize";
import { showUndoToast } from "@/utils/undo-toast";

// -- Types --------------------------------------------------------------------

type SplitMatchingWordsParams = Parameters<ProjectStore["splitSyllablesAcrossIdenticalWordsWithHistory"]>[0];

// -- Action -------------------------------------------------------------------

function splitMatchingWords(params: SplitMatchingWordsParams, matchCount: number): void {
  const before = useProjectStore.getState().lines;
  useProjectStore.getState().splitSyllablesAcrossIdenticalWordsWithHistory(params);
  if (useProjectStore.getState().lines !== before) showUndoToast(`Split ${pluralize(matchCount, "matching word")}`);
}

// -- Exports ------------------------------------------------------------------

export { splitMatchingWords };
