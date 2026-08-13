import type { LyricLine } from "@/domain/line/model";
import { createLine } from "@/test/factories";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

// -- Store write seam ---------------------------------------------------------

interface CapturedUpdate {
  id: string;
  updates: Partial<LyricLine>;
  options?: { propagateToSiblings?: boolean };
}

function captureUpdates() {
  const calls: CapturedUpdate[] = [];
  const updateLineWithHistory = (
    id: string,
    updates: Partial<LyricLine>,
    options?: { propagateToSiblings?: boolean },
  ) => {
    calls.push({ id, updates, options });
  };
  return { calls, updateLineWithHistory };
}

// -- Factory instances --------------------------------------------------------

const wordsOps = createWordTimingOps({ getWords: (line) => line.words, updateKey: "words" });
const bgOps = createWordTimingOps({ getWords: (line) => line.backgroundWords, updateKey: "backgroundWords" });

// -- Fixtures -----------------------------------------------------------------

function makeLine() {
  return createLine({
    text: "a b c",
    words: [
      { text: "a", begin: 0, end: 1 },
      { text: "b", begin: 1, end: 2 },
      { text: "c", begin: 2, end: 3 },
    ],
  });
}

// -- Exports ------------------------------------------------------------------

export { bgOps, captureUpdates, makeLine, wordsOps };
