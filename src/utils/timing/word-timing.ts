import { effectiveTimingWrite } from "@/domain/line/effective-words";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

const { nudgeBegin, setBegin, nudgeEnd, setEnd, setBoundary, stepEdit } = createWordTimingOps({
  getWords: (line) => line.words,
  writeWords: effectiveTimingWrite,
});

export {
  nudgeBegin as nudgeWordBegin,
  nudgeEnd as nudgeWordEnd,
  setBegin as setWordBegin,
  setBoundary as setWordBoundary,
  setEnd as setWordEnd,
  stepEdit as stepWordEdit,
};
