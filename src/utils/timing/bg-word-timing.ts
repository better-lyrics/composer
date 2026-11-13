import { manualBackgroundWordEdit } from "@/domain/line/background";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

const { retimeEdit, boundaryEdit, stepEdit } = createWordTimingOps({
  getWords: (line) => line.backgroundWords,
  writeWords: (_line, words) => ({ backgroundWords: words }),
  buildBoundaryUpdate: manualBackgroundWordEdit,
});

export { boundaryEdit as bgWordBoundaryEdit, retimeEdit as bgWordRetimeEdit, stepEdit as stepBgWordEdit };
