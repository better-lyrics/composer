import { manualBackgroundWordEdit } from "@/domain/line/background";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

const { nudgeBegin, setBegin, nudgeEnd, setEnd, setBoundary } = createWordTimingOps({
  getWords: (line) => line.backgroundWords,
  updateKey: "backgroundWords",
  buildUpdate: manualBackgroundWordEdit,
});

export {
  nudgeBegin as nudgeBgWordBegin,
  setBegin as setBgWordBegin,
  nudgeEnd as nudgeBgWordEnd,
  setEnd as setBgWordEnd,
  setBoundary as setBgWordBoundary,
};
