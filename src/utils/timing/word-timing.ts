import { effectiveTimingWrite } from "@/domain/line/effective-words";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

const { retimeEdit, boundaryEdit, stepEdit } = createWordTimingOps({
  getWords: (line) => timedSyllables(mainTrack(line)),
  writeWords: effectiveTimingWrite,
});

export { boundaryEdit as wordBoundaryEdit, retimeEdit as wordRetimeEdit, stepEdit as stepWordEdit };
