import { effectiveTimingWrite } from "@/domain/line/effective-words";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

const { nudgeBegin, setBegin, nudgeEnd, setEnd, boundaryEdit, stepEdit } = createWordTimingOps({
  getWords: (line) => line.words,
  writeWords: effectiveTimingWrite,
});

export {
  boundaryEdit as wordBoundaryEdit,
  nudgeBegin as nudgeWordBegin,
  nudgeEnd as nudgeWordEnd,
  setBegin as setWordBegin,
  setEnd as setWordEnd,
  stepEdit as stepWordEdit,
};
