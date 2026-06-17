import { bgWords } from "@/domain/line/voices";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

const { nudgeBegin, setBegin, nudgeEnd, setEnd } = createWordTimingOps({
  getWords: (line) => bgWords(line),
  updateKey: "backgroundWords",
});

export {
  nudgeBegin as nudgeBgWordBegin,
  setBegin as setBgWordBegin,
  nudgeEnd as nudgeBgWordEnd,
  setEnd as setBgWordEnd,
};
