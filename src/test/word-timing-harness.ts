import { effectiveTimingWrite } from "@/domain/line/effective-words";
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

const wordsOps = createWordTimingOps({ getWords: (line) => line.words, writeWords: effectiveTimingWrite });
const bgOps = createWordTimingOps({
  getWords: (line) => line.backgroundWords,
  writeWords: (_line, words) => ({ backgroundWords: words }),
});

// -- Fixtures -----------------------------------------------------------------

// Trailing spaces mark word ends: without them these three read as one word
// split into three syllables, which is a different rolling-boundary case.
function makeLine() {
  return createLine({
    text: "a b c",
    words: [
      { text: "a ", begin: 0, end: 1 },
      { text: "b ", begin: 1, end: 2 },
      { text: "c", begin: 2, end: 3 },
    ],
  });
}

// -- Exports ------------------------------------------------------------------

export { bgOps, captureUpdates, makeLine, wordsOps };
