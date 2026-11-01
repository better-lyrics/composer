import { manualBackgroundWordEdit } from "@/domain/line/background";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

const { nudgeBegin, setBegin, nudgeEnd, setEnd, setBoundary } = createWordTimingOps({
  getWords: (line) => line.backgroundWords,
  writeWords: (_line, words) => ({ backgroundWords: words }),
  buildBoundaryUpdate: manualBackgroundWordEdit,
});

export {
  nudgeBegin as nudgeBgWordBegin,
  setBegin as setBgWordBegin,
  nudgeEnd as nudgeBgWordEnd,
  setEnd as setBgWordEnd,
  setBoundary as setBgWordBoundary,
};
