import { effectiveTimingWrite } from "@/domain/line/effective-words";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

const { retimeEdit, boundaryEdit, stepEdit } = createWordTimingOps({
  getWords: (line) => line.words,
  writeWords: effectiveTimingWrite,
});

export { boundaryEdit as wordBoundaryEdit, retimeEdit as wordRetimeEdit, stepEdit as stepWordEdit };
