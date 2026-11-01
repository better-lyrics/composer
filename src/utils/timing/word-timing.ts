import { effectiveTimingWrite } from "@/domain/line/effective-words";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

const { nudgeBegin, setBegin, nudgeEnd, setEnd, setBoundary } = createWordTimingOps({
  getWords: (line) => line.words,
  writeWords: effectiveTimingWrite,
});

export {
  nudgeBegin as nudgeWordBegin,
  setBegin as setWordBegin,
  nudgeEnd as nudgeWordEnd,
  setEnd as setWordEnd,
  setBoundary as setWordBoundary,
};
