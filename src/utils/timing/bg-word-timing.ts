import { manualBackgroundWordEdit } from "@/domain/line/background";
import { backgroundTrack, timedSyllables } from "@/domain/line/track";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

const { retimeEdit, boundaryEdit, stepEdit } = createWordTimingOps({
  getWords: (line) => timedSyllables(backgroundTrack(line)),
  writeWords: (_line, words) => ({ backgroundWords: words }),
  buildBoundaryUpdate: manualBackgroundWordEdit,
});

export { boundaryEdit as bgWordBoundaryEdit, retimeEdit as bgWordRetimeEdit, stepEdit as stepBgWordEdit };
