import { effectiveTimingWrite } from "@/domain/line/effective-words";
import { UNBOUNDED_TIME_RANGE } from "@/domain/group/shared-timing";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import type { BoundaryEdge } from "@/domain/word/boundary";
import { createLine } from "@/test/factories";
import { type RetimeChange, createWordTimingOps } from "@/utils/timing/word-timing-ops";

// -- Retime seam --------------------------------------------------------------

type RetimeEdit = ReturnType<typeof createWordTimingOps>["retimeEdit"];

// Plans one Sync retime with no shared range and collects the update it writes.
function retimeInto(
  calls: LineUpdate[],
  retimeEdit: RetimeEdit,
  edge: BoundaryEdge,
  change: RetimeChange,
  lines: readonly LyricLine[],
  lineIdx: number,
  wordIdx: number,
): void {
  const line = lines[lineIdx];
  const update = line ? retimeEdit({ line, wordIdx, edge, change, range: UNBOUNDED_TIME_RANGE }) : null;
  if (update) calls.push(update);
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
      { text: "a", sep: " ", begin: 0, end: 1 },
      { text: "b", sep: " ", begin: 1, end: 2 },
      { text: "c", begin: 2, end: 3 },
    ],
  });
}

// -- Exports ------------------------------------------------------------------

export { bgOps, makeLine, retimeInto, wordsOps };
