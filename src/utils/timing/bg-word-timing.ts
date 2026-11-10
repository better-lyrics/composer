import { manualBackgroundWordEdit } from "@/domain/line/background";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

const { nudgeBegin, setBegin, nudgeEnd, setEnd, setBoundary, stepEdit } = createWordTimingOps({
  getWords: (line) => line.backgroundWords,
  writeWords: (_line, words) => ({ backgroundWords: words }),
  buildBoundaryUpdate: manualBackgroundWordEdit,
});

export {
  nudgeBegin as nudgeBgWordBegin,
  nudgeEnd as nudgeBgWordEnd,
  setBegin as setBgWordBegin,
  setBoundary as setBgWordBoundary,
  setEnd as setBgWordEnd,
  stepEdit as stepBgWordEdit,
};
